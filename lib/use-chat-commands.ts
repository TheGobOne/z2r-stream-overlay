"use client"

import { useEffect, useRef, useState } from "react"
import { parseChatCommand, type ChatAction } from "@/lib/chat-commands"
import { cleanChannel, joinChat, type ChatStatus } from "@/lib/twitch-chat"

const CHANNEL_KEY = "z2r-chat-channel"
const ON_KEY = "z2r-chat-on"
const EVERYONE_KEY = "z2r-chat-everyone"
const MAX_PER_SECOND = 10
const LOG_LENGTH = 6

export type ChatLogEntry = { id: number; user: string; text: string }

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

/** Lets chat run boss and item commands. Moderators and the streamer only, unless `everyone` is on. */
export function useChatCommands(runnerCount: number, onAction: (action: ChatAction) => void) {
  const [channel, setChannelState] = useState("")
  const [on, setOnState] = useState(false)
  const [everyone, setEveryoneState] = useState(false)
  const [status, setStatus] = useState<ChatStatus>("stopped")
  const [log, setLog] = useState<ChatLogEntry[]>([])
  const [loaded, setLoaded] = useState(false)

  const runnerCountRef = useRef(runnerCount)
  runnerCountRef.current = runnerCount
  const onActionRef = useRef(onAction)
  onActionRef.current = onAction
  const everyoneRef = useRef(everyone)
  everyoneRef.current = everyone

  useEffect(() => {
    setChannelState(read(CHANNEL_KEY))
    setOnState(read(ON_KEY) === "1")
    setEveryoneState(read(EVERYONE_KEY) === "1")
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
        const now = Date.now()
        if (now - windowStart > 1000) {
          windowStart = now
          count = 0
        }
        if (++count > MAX_PER_SECOND) return
        onActionRef.current(parsed.action)
        setLog((prev) => [{ id: nextId++, user: message.user, text: parsed.summary }, ...prev].slice(0, LOG_LENGTH))
      },
      setStatus,
    )
    return () => chat.stop()
  }, [loaded, on, clean])

  return {
    channel,
    on,
    everyone,
    status,
    log,
    validChannel: clean !== "",
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
  }
}
