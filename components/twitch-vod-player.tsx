"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react"
import { toTwitchTime, VOD_WINDOWS, type VodConfig, type VodFrameLayout, type VodSide } from "@/lib/vod"

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
  layout: VodFrameLayout
  onAutoMute: () => void
  /** Lift this player above the settings panel while it is being edited. */
  raised?: boolean
}

// Twitch's player draws a thin grey edge, and fractional offsets leave a sub-pixel seam,
// so the frame is grown a few pixels past the window (keeping aspect) and clipped away.
const EDGE_OVERSCAN_PX = 3

function overscan(layout: VodFrameLayout) {
  const scale = (layout.height + EDGE_OVERSCAN_PX * 2) / layout.height
  const width = layout.width * scale
  const height = layout.height * scale
  return {
    width,
    height,
    left: layout.left - (width - layout.width) / 2,
    top: layout.top - (height - layout.height) / 2,
  }
}

const AUTOPLAY_CHECK_MS = 1200
const MAX_PLAY_ATTEMPTS = 4

export const TwitchVodPlayer = forwardRef<VodPlayerHandle, Props>(function TwitchVodPlayer(
  { side, config, layout, onAutoMute, raised = false },
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

  const { videoId, channel, loadKey, muted, volume } = config
  const isLive = !videoId && Boolean(channel)

  useEffect(() => {
    const host = hostRef.current
    if (!host || (!videoId && !channel)) return
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
          ...(videoId
            ? { video: `v${videoId}`, time: toTwitchTime(latest.current.startSeconds) }
            : { channel }),
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
          if (pendingPlayRef.current) attemptPlay(player)
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
  }, [videoId, channel, loadKey, mountId])

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
      if (player && readyRef.current) attemptPlay(player)
    },
    pause: () => {
      pendingPlayRef.current = false
      if (readyRef.current) playerRef.current?.pause()
    },
    seekTo: (seconds) => {
      if (readyRef.current && !isLive) playerRef.current?.seek(Math.max(0, seconds))
    },
    nudge: (seconds) => {
      const player = playerRef.current
      if (player && readyRef.current && !isLive) player.seek(Math.max(0, player.getCurrentTime() + seconds))
    },
    getCurrentTime: () => (readyRef.current ? (playerRef.current?.getCurrentTime() ?? null) : null),
    isPaused: () => (readyRef.current ? (playerRef.current?.isPaused() ?? true) : true),
  }))

  if (!videoId && !channel) return null

  const win = VOD_WINDOWS[side]

  return (
    <div
      className="vod-window"
      style={{
        left: win.left,
        top: win.top,
        width: win.width,
        height: win.height,
        clipPath: win.clipPath,
        zIndex: raised ? 902 : layout.onTop ? 14 : 13,
      }}
    >
      <div
        ref={hostRef}
        className="vod-frame"
        style={overscan(layout)}
      />
    </div>
  )
})
