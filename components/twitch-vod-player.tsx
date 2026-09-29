"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import { toTwitchTime, VOD_WINDOWS, type VodConfig, type VodSide } from "@/lib/vod"

type TwitchPlayer = {
  play(): void
  pause(): void
  seek(seconds: number): void
  getCurrentTime(): number
  isPaused(): boolean
  setMuted(muted: boolean): void
  getMuted(): boolean
  setVolume(volume: number): void
  addEventListener(event: string, callback: () => void): void
}

type TwitchPlayerConstructor = {
  new (elementId: string, options: Record<string, unknown>): TwitchPlayer
  READY: string
}

declare global {
  interface Window {
    Twitch?: { Player: TwitchPlayerConstructor }
  }
}

export type VodPlayerHandle = {
  play(): void
  pause(): void
  seekTo(seconds: number): void
  nudge(seconds: number): void
  getCurrentTime(): number | null
  isPaused(): boolean
}

let embedScript: Promise<void> | null = null

function loadTwitchEmbed() {
  if (window.Twitch?.Player) return Promise.resolve()
  embedScript ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://player.twitch.tv/js/embed/v1.js"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      embedScript = null
      reject(new Error("Failed to load the Twitch embed script"))
    }
    document.head.appendChild(script)
  })
  return embedScript
}

// Twitch refuses to play unless every embedding domain is listed as a parent,
// which includes the v0 preview frame and any page that iframes the overlay.
function getParentDomains() {
  const hosts = new Set<string>([window.location.hostname])
  const ancestors = window.location.ancestorOrigins
  if (ancestors) {
    for (let i = 0; i < ancestors.length; i++) {
      try {
        hosts.add(new URL(ancestors[i]).hostname)
      } catch {}
    }
  } else if (document.referrer) {
    try {
      hosts.add(new URL(document.referrer).hostname)
    } catch {}
  }
  return [...hosts]
}

type Props = {
  side: VodSide
  config: VodConfig
  onAutoMute: () => void
  /** Lift this player above the settings panel while it is being edited. */
  raised?: boolean
}

const AUTOPLAY_CHECK_MS = 1200
const MAX_PLAY_ATTEMPTS = 4
// IntersectionObserver v2 reports visibility changes no faster than every 100ms
const VISIBILITY_SETTLE_MS = 250
const PLAY_START_TIMEOUT_MS = AUTOPLAY_CHECK_MS * (MAX_PLAY_ATTEMPTS + 1) + 500

// Each window's zoomed iframe extends under the other window, so only the top one passes
// Twitch's visibility check. Players take turns being lifted to the top while they start.
let playStartQueue: Promise<void> = Promise.resolve()

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

export const TwitchVodPlayer = forwardRef<VodPlayerHandle, Props>(function TwitchVodPlayer(
  { side, config, onAutoMute, raised = false },
  ref,
) {
  const mountId = `twitch-vod-${side}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<TwitchPlayer | null>(null)
  const readyRef = useRef(false)
  const pendingPlayRef = useRef(false)
  const latest = useRef(config)
  latest.current = config
  const onAutoMuteRef = useRef(onAutoMute)
  onAutoMuteRef.current = onAutoMute
  const [boosted, setBoosted] = useState(false)
  const startQueuedRef = useRef(false)

  function requestPlay(player: TwitchPlayer) {
    if (startQueuedRef.current) return
    startQueuedRef.current = true
    const isStillWanted = () => playerRef.current === player && pendingPlayRef.current

    playStartQueue = playStartQueue.then(async () => {
      try {
        if (!isStillWanted()) return
        setBoosted(true)
        await wait(VISIBILITY_SETTLE_MS)
        if (!isStillWanted()) return
        const startedAt = player.getCurrentTime()
        attemptPlay(player)
        const deadline = Date.now() + PLAY_START_TIMEOUT_MS
        while (isStillWanted() && Date.now() < deadline) {
          await wait(200)
          if (player.getCurrentTime() - startedAt > 0.25) break
        }
      } finally {
        startQueuedRef.current = false
        setBoosted(false)
      }
    })
  }

  function attemptPlay(player: TwitchPlayer, attempt = 0) {
    const startedAt = player.getCurrentTime()
    player.play()
    window.setTimeout(() => {
      if (playerRef.current !== player || !pendingPlayRef.current) return
      // Twitch's isPaused() can report "playing" while the browser has blocked playback,
      // so check whether the playhead actually moved before retrying.
      if (player.getCurrentTime() - startedAt > 0.25) return
      if (attempt >= MAX_PLAY_ATTEMPTS) return
      if (attempt === 0 && !player.getMuted()) {
        player.setMuted(true)
        onAutoMuteRef.current()
      }
      // A paused-then-played cycle un-sticks embeds that silently ignored the first play()
      player.pause()
      attemptPlay(player, attempt + 1)
    }, AUTOPLAY_CHECK_MS)
  }

  const { videoId, loadKey, muted, volume, zoom, centerX, centerY } = config

  useEffect(() => {
    const host = hostRef.current
    if (!host || !videoId) return
    let cancelled = false

    const mount = document.createElement("div")
    mount.id = mountId
    mount.style.width = "100%"
    mount.style.height = "100%"
    host.replaceChildren(mount)

    loadTwitchEmbed()
      .then(() => {
        if (cancelled || !window.Twitch) return
        const player = new window.Twitch.Player(mountId, {
          width: "100%",
          height: "100%",
          video: `v${videoId}`,
          time: toTwitchTime(latest.current.startSeconds),
          autoplay: false,
          muted: latest.current.muted,
          parent: getParentDomains(),
        })
        playerRef.current = player
        const markReady = () => {
          if (cancelled || readyRef.current) return
          readyRef.current = true
          player.setVolume(latest.current.volume)
          // Unmuting before playback starts makes browsers block the next play() call
          if (latest.current.muted) player.setMuted(true)
          if (pendingPlayRef.current) requestPlay(player)
        }
        player.addEventListener(window.Twitch.Player.READY, markReady)
        player.addEventListener("playing", markReady)
        player.addEventListener("play", markReady)
      })
      .catch((error) => console.error(error))

    return () => {
      cancelled = true
      playerRef.current = null
      readyRef.current = false
      pendingPlayRef.current = false
      host.replaceChildren()
    }
  }, [videoId, loadKey, mountId])

  useEffect(() => {
    playerRef.current?.setMuted(muted)
  }, [muted])

  useEffect(() => {
    playerRef.current?.setVolume(volume)
  }, [volume])

  useImperativeHandle(ref, () => ({
    play: () => {
      pendingPlayRef.current = true
      const player = playerRef.current
      if (player && readyRef.current) requestPlay(player)
    },
    pause: () => {
      pendingPlayRef.current = false
      if (readyRef.current) playerRef.current?.pause()
    },
    seekTo: (seconds) => {
      if (readyRef.current) playerRef.current?.seek(Math.max(0, seconds))
    },
    nudge: (seconds) => {
      const player = playerRef.current
      if (player && readyRef.current) player.seek(Math.max(0, player.getCurrentTime() + seconds))
    },
    getCurrentTime: () => (readyRef.current ? (playerRef.current?.getCurrentTime() ?? null) : null),
    isPaused: () => (readyRef.current ? (playerRef.current?.isPaused() ?? true) : true),
  }))

  if (!videoId) return null

  const win = VOD_WINDOWS[side]
  const frameWidth = win.width * zoom
  const frameHeight = (frameWidth * 9) / 16

  return (
    <div
      className="vod-window"
      style={{
        left: win.left,
        top: win.top,
        width: win.width,
        height: win.height,
        clipPath: win.clipPath,
        // Chrome's visibility check (which Twitch uses to allow playback) tests the iframe's
        // full rect, including the zoomed overflow that's cropped away.
        zIndex: raised ? 902 : boosted ? 16 : side === "left" ? 14 : 13,
      }}
    >
      <div
        ref={hostRef}
        className="vod-frame"
        style={{
          width: frameWidth,
          height: frameHeight,
          left: win.width / 2 - centerX * frameWidth,
          top: win.height / 2 - centerY * frameHeight,
        }}
      />
    </div>
  )
})
