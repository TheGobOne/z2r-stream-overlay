"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react"
import { toTwitchTime, VOD_WINDOWS, type VodConfig, type VodSide } from "@/lib/vod"

type TwitchPlayer = {
  play(): void
  pause(): void
  seek(seconds: number): void
  getCurrentTime(): number
  isPaused(): boolean
  setMuted(muted: boolean): void
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
  interactive: boolean
}

export const TwitchVodPlayer = forwardRef<VodPlayerHandle, Props>(function TwitchVodPlayer(
  { side, config, interactive },
  ref,
) {
  const mountId = `twitch-vod-${side}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<TwitchPlayer | null>(null)
  const latest = useRef(config)
  latest.current = config

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
        player.addEventListener(window.Twitch.Player.READY, () => {
          if (cancelled) return
          playerRef.current = player
          player.setVolume(latest.current.volume)
          player.setMuted(latest.current.muted)
        })
      })
      .catch((error) => console.error(error))

    return () => {
      cancelled = true
      playerRef.current = null
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
    play: () => playerRef.current?.play(),
    pause: () => playerRef.current?.pause(),
    seekTo: (seconds) => playerRef.current?.seek(Math.max(0, seconds)),
    nudge: (seconds) => {
      const player = playerRef.current
      if (player) player.seek(Math.max(0, player.getCurrentTime() + seconds))
    },
    getCurrentTime: () => playerRef.current?.getCurrentTime() ?? null,
    isPaused: () => playerRef.current?.isPaused() ?? true,
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
        pointerEvents: interactive ? "auto" : "none",
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
