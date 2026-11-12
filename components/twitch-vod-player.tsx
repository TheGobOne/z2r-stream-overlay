"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import { frameInWindow, toTwitchTime, UNCROPPED_VIEW, VOD_WINDOWS, type VodConfig, type VodFrameLayout, type VodSide, type WindowRect } from "@/lib/vod"

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
  new (element: string | HTMLElement, options: Record<string, unknown>): TwitchPlayer
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

export function loadTwitchEmbed() {
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
export function getParentDomains() {
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
  /** "left"/"right" for the two-runner layout, or any unique key when `win` is given. */
  side: string
  /** Window to render into; defaults to the two-runner window for `side`. */
  win?: WindowRect
  config: VodConfig
  layout: VodFrameLayout
  onAutoMute: () => void
  /** Lift this player above the settings panel while it is being edited. */
  raised?: boolean
  /** Black out around the crop where it actually sits, for layouts that slide or zoom the frame off-center. */
  maskAtCrop?: boolean
}

// Twitch's player draws a thin grey edge, and fractional offsets leave a sub-pixel seam,
// so the frame is grown a few pixels past the window (keeping aspect) and clipped away.
const EDGE_OVERSCAN_PX = 3

// Twitch letterboxes inside a non-16:9 iframe, so the iframe stays 16:9 and a scaleY
// transform stretches it to a cropped layout's height.
function stretchedFrame(layout: VodFrameLayout): React.CSSProperties & { left: number; top: number } {
  const scale = (layout.height + EDGE_OVERSCAN_PX * 2) / layout.height
  const width = layout.width * scale
  const height = layout.height * scale
  const naturalHeight = (width * 9) / 16
  const stretchY = height / naturalHeight
  const stretched = Math.abs(stretchY - 1) > 0.001
  return {
    width,
    height: stretched ? naturalHeight : height,
    left: layout.left - (width - layout.width) / 2,
    top: layout.top - (height - layout.height) / 2,
    transform: stretched ? `scaleY(${stretchY})` : undefined,
    transformOrigin: "top left",
  }
}

// Grow the frame a few pixels past the window (keeping 16:9) and center it. No scaleY stretch:
// Twitch treats a squashed player as hidden and refuses or pauses playback.
function flatFrame(layout: VodFrameLayout): React.CSSProperties {
  const scale = (layout.height + EDGE_OVERSCAN_PX * 2) / layout.height
  const width = layout.width * scale
  const height = (width * 9) / 16
  return {
    width,
    height,
    left: layout.left - (width - layout.width) / 2,
    top: layout.top + layout.height / 2 - height / 2,
  }
}

const AUTOPLAY_CHECK_MS = 1200
const START_SETTLE_MS = 250
const START_GIVE_UP_MS = 8000
const MAX_PLAY_ATTEMPTS = 4

export const TwitchVodPlayer = forwardRef<VodPlayerHandle, Props>(function TwitchVodPlayer(
  { side, win: winProp, config, layout, onAutoMute, raised = false, maskAtCrop = false },
  ref,
) {
  const mountId = `twitch-vod-${side}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<TwitchPlayer | null>(null)
  const readyRef = useRef(false)
  const pendingPlayRef = useRef(false)
  // Twitch ignores script play() while anything covers or transforms its iframe, so the crop
  // mask and the scaleY stretch are dropped from the moment play is asked until video runs.
  const [starting, setStarting] = useState(false)
  // Bumped on every play request so a repeat request re-runs the start effect
  const [startTick, setStartTick] = useState(0)
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
      if (player.getCurrentTime() - startedAt > 0.25) {
        setStarting(false)
        return
      }
      if (attempt >= MAX_PLAY_ATTEMPTS) {
        setStarting(false)
        return
      }
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
          controls: false,
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
        player.addEventListener("playing", () => {
          if (!cancelled) setStarting(false)
        })
      })
      .catch((error) => console.error(error))

    return () => {
      cancelled = true
      playerRef.current = null
      readyRef.current = false
      pendingPlayRef.current = false
      setStarting(false)
      host.replaceChildren()
    }
  }, [videoId, channel, loadKey, mountId])

  useEffect(() => {
    playerRef.current?.setMuted(muted)
  }, [muted])

  useEffect(() => {
    playerRef.current?.setVolume(volume)
  }, [volume])

  // Let the unmasked, untransformed frame paint and Twitch's visibility check see it
  // before sending play(); give up on the clean frame if video never starts.
  useEffect(() => {
    if (!startTick) return
    const playTimer = window.setTimeout(() => {
      const player = playerRef.current
      if (player && readyRef.current && pendingPlayRef.current) attemptPlay(player)
    }, START_SETTLE_MS)
    const giveUp = window.setTimeout(() => setStarting(false), START_GIVE_UP_MS)
    return () => {
      window.clearTimeout(playTimer)
      window.clearTimeout(giveUp)
    }
  }, [startTick])

  useImperativeHandle(ref, () => ({
    play: () => {
      pendingPlayRef.current = true
      // Always go through the clean frame: Twitch's isPaused() can report false after a
      // seek, and skipping the clean frame then leaves the mask up and play() blocked.
      const player = playerRef.current
      setStarting(true)
      setStartTick((n) => n + 1)
    },
    pause: () => {
      pendingPlayRef.current = false
      setStarting(false)
      const player = playerRef.current
      if (readyRef.current && player) player.pause()
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

  const win = winProp ?? VOD_WINDOWS[side as VodSide]
  const frameLayout = layout

  // Crop by clipping, never by covering or transforming the iframe: Twitch keeps checking that
  // nothing sits over its player or squashes it, and pauses autoplayed video when that fails.
  const crop = config.crop
  let clip: React.CSSProperties = { left: 0, top: 0, width: win.width, height: win.height }
  let frame: React.CSSProperties = flatFrame(frameLayout)
  if (crop) {
    // Stretched like the original crops (same size and place as the old black mask), but cut out
    // by clipping instead of a mask drawn over the video. Twitch may still pause a player it
    // started on its own once the stretch applies; the pause listener then asks for one real click.
    // Use the un-nudged frame: resolveVodLayouts slides a frame sideways to keep it out from under
    // the other player, which shifted the crop off the chosen area. Clipping already keeps them apart.
    const L = maskAtCrop ? frameLayout : { ...frameLayout, ...frameInWindow(win, config) }
    const width = (crop.x1 - crop.x0) * L.width
    const height = (crop.y1 - crop.y0) * L.height
    clip = maskAtCrop
      ? { left: L.left + crop.x0 * L.width, top: L.top + crop.y0 * L.height, width, height }
      : { left: (win.width - width) / 2, top: (win.height - height) / 2, width, height }
    const stretched = stretchedFrame(L)
    frame = {
      ...stretched,
      left: (stretched.left as number) - (clip.left as number),
      top: (stretched.top as number) - (clip.top as number),
    }
  }

  return (
    <div
      className="vod-window"
      style={{
        left: win.left,
        top: win.top,
        width: win.width,
        height: win.height,
        clipPath: win.clipPath,
        zIndex: raised ? 902 : (layout.z ?? (layout.onTop ? 14 : 13)),
      }}
    >
      <div className="vod-clip" style={{ position: "absolute", overflow: "hidden", ...clip }}>
        <div ref={hostRef} className="vod-frame" style={frame} />
      </div>
    </div>
  )
})
