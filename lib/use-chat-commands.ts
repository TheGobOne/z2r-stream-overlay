"use client"

import { useEffect, useRef, useState } from "react"
import { parseChatCommand, type PageAction } from "@/lib/chat-commands"
import { pickWinner } from "@/lib/chat-poll"
import { cleanChannel, joinChat, type ChatStatus } from "@/lib/twitch-chat"

const CHANNEL_KEY = "z2r-chat-channel"
const ON_KEY = "z2r-chat-on"
const EVERYONE_KEY = "z2r-chat-everyone"
const POLL_SECONDS_KEY = "z2r-chat-poll-seconds"
const LOCK_MINUTES_KEY = "z2r-chat-lock-minutes"
const DEFAULT_POLL_SECONDS = 60
const DEFAULT_LOCK_MINUTES = 15
const MAX_PER_SECOND = 10
const LOG_LENGTH = 6

export type ChatLogEntry = { id: number; user: string; text: string }

/** idle: no vote. voting: chat is voting for who is heard. locked: the winner is locked in. */
export type PollView = {
  phase: "idle" | "voting" | "locked"
  /** When the vote or the lock ends (ms since epoch); 0 while idle. */
  endsAt: number
  /** Votes per player. */
  counts: number[]
  /** The player the last vote picked, while locked. */
  winner: number | null
}

const IDLE_POLL: PollView = { phase: "idle", endsAt: 0, counts: [0, 0, 0, 0], winner: null }

function read(key: string): string {
  try {
    return localStorage.getItem(key) ?? ""
  } catch {
    return ""
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {}
}
function readNumber(key: string, fallback: number, min: number, max: number) {
  const n = Number(read(key))
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback
}

/**
 * Lets chat run boss and item commands, and vote on who the audience hears.
 * Anyone can by default; turn `everyone` off for moderators and the streamer only.
 * `currentListener` is the player with sound now (a tied vote keeps it), or null when unknown.
 */
export function useChatCommands(runnerCount: number, currentListener: number | null, onAction: (action: PageAction) => void) {
  const [channel, setChannelState] = useState("")
  const [on, setOnState] = useState(false)
  const [everyone, setEveryoneState] = useState(true)
  const [pollSeconds, setPollSecondsState] = useState(DEFAULT_POLL_SECONDS)
  const [lockMinutes, setLockMinutesState] = useState(DEFAULT_LOCK_MINUTES)
  const [status, setStatus] = useState<ChatStatus>("stopped")
  const [log, setLog] = useState<ChatLogEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [poll, setPoll] = useState<PollView>(IDLE_POLL)

  const runnerCountRef = useRef(runnerCount)
  runnerCountRef.current = runnerCount
  const listenerRef = useRef(currentListener)
  listenerRef.current = currentListener
  const onActionRef = useRef(onAction)
  onActionRef.current = onAction
  const everyoneRef = useRef(everyone)
  everyoneRef.current = everyone
  const pollSecondsRef = useRef(pollSeconds)
  pollSecondsRef.current = pollSeconds
  const lockMinutesRef = useRef(lockMinutes)
  lockMinutesRef.current = lockMinutes

  // The poll lives in a ref so chat messages and the timer always see the latest; `poll` mirrors it for rendering
  const pollRef = useRef<PollView>(IDLE_POLL)
  const votesRef = useRef(new Map<string, number>())

  function publish(next: PollView) {
    pollRef.current = next
    setPoll(next)
  }

  function tally() {
    const counts = [0, 0, 0, 0]
    for (const runner of votesRef.current.values()) counts[runner] += 1
    return counts
  }

  function startPoll() {
    if (pollRef.current.phase !== "idle") return false
    votesRef.current = new Map()
    publish({ phase: "voting", endsAt: Date.now() + pollSecondsRef.current * 1000, counts: [0, 0, 0, 0], winner: null })
    return true
  }

  function castVote(user: string, runner: number) {
    if (pollRef.current.phase !== "voting" || runner >= runnerCountRef.current) return
    votesRef.current.set(user.toLowerCase(), runner)
    publish({ ...pollRef.current, counts: tally() })
  }

  /** Ends the vote now (the winner gets the sound and is locked in) or ends the lock early. */
  function endNow() {
    const current = pollRef.current
    if (current.phase === "voting") {
      const winner = pickWinner(tally().slice(0, runnerCountRef.current), listenerRef.current)
      if (winner !== null) onActionRef.current({ type: "audio", runners: [winner] })
      publish({ phase: "locked", endsAt: Date.now() + lockMinutesRef.current * 60000, counts: tally(), winner })
    } else if (current.phase === "locked") {
      votesRef.current = new Map()
      publish(IDLE_POLL)
    }
  }
  const endNowRef = useRef(endNow)
  endNowRef.current = endNow

  // While a vote or lock runs, check the clock twice a second (this also refreshes the countdowns)
  useEffect(() => {
    if (poll.phase === "idle") return
    const timer = window.setInterval(() => {
      if (Date.now() >= pollRef.current.endsAt) endNowRef.current()
      else setPoll({ ...pollRef.current })
    }, 500)
    return () => window.clearInterval(timer)
  }, [poll.phase])

  useEffect(() => {
    setChannelState(read(CHANNEL_KEY))
    setOnState(read(ON_KEY) === "1")
    // Anyone in chat can use commands unless this was turned off
    setEveryoneState(read(EVERYONE_KEY) !== "0")
    setPollSecondsState(readNumber(POLL_SECONDS_KEY, DEFAULT_POLL_SECONDS, 10, 600))
    setLockMinutesState(readNumber(LOCK_MINUTES_KEY, DEFAULT_LOCK_MINUTES, 1, 120))
    setLoaded(true)
  }, [])

  const clean = cleanChannel(channel)
  useEffect(() => {
    if (!loaded || !on || !clean) {
      setStatus("stopped")
      return
    }
    let windowStart = 0
    let count = 0
    let nextId = 0
    const chat = joinChat(
      clean,
      (message) => {
        if (!message.privileged && !everyoneRef.current) return
        const parsed = parseChatCommand(message.text, runnerCountRef.current)
        if (!parsed) return
        if (parsed.modOnly && !message.privileged) return
        const now = Date.now()
        if (now - windowStart > 1000) {
          windowStart = now
          count = 0
        }
        if (++count > MAX_PER_SECOND) return
        const action = parsed.action
        if (action.type === "startPoll") {
          if (!startPoll()) return
        } else if (action.type === "vote") {
          if (pollRef.current.phase !== "voting") return
          castVote(message.user, action.runner)
        } else onActionRef.current(action)
        setLog((prev) => [{ id: nextId++, user: message.user, text: parsed.summary }, ...prev].slice(0, LOG_LENGTH))
      },
      setStatus,
    )
    return () => chat.stop()
    // startPoll and castVote only use refs, so they are safe to leave out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, on, clean])

  return {
    channel,
    on,
    everyone,
    status,
    log,
    poll,
    pollSeconds,
    lockMinutes,
    validChannel: clean !== "",
    startPoll,
    endNow,
    setChannel: (value: string) => {
      setChannelState(value)
      write(CHANNEL_KEY, value)
    },
    setOn: (value: boolean) => {
      setOnState(value)
      write(ON_KEY, value ? "1" : "0")
    },
    setEveryone: (value: boolean) => {
      setEveryoneState(value)
      write(EVERYONE_KEY, value ? "1" : "0")
    },
    setPollSeconds: (value: number) => {
      setPollSecondsState(value)
      write(POLL_SECONDS_KEY, String(value))
    },
    setLockMinutes: (value: number) => {
      setLockMinutesState(value)
      write(LOCK_MINUTES_KEY, String(value))
    },
  }
}
