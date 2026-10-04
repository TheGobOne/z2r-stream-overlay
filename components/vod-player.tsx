"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react"
import { Music } from "lucide-react"
import { TwitchVodPlayer, type VodPlayerHandle } from "@/components/twitch-vod-player"
import { VOD_WINDOWS, type VodConfig, type VodFrameLayout, type VodSide, type WindowRect } from "@/lib/vod"

export type { VodPlayerHandle }

type YouTubePlayer = {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  getCurrentTime(): number
  getPlayerState(): number
  mute(): void
  unMute(): void
  isMuted(): boolean
  setVolume(volume: number): void
}

type YouTubePlayerConstructor = new (elementId: string, options: Record<string, unknown>) => YouTubePlayer

declare global {
  interface Window {
    YT?: { Player: YouTubePlayerConstructor }
    onYouTubeIframeAPIReady?: () => void
  }
}

let embedScript: Promise<void> | null = null

function loadYouTubeEmbed() {
  if (window.YT?.Player) return Promise.resolve()
  embedScript ??= new Promise<void>((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.()
      resolve()
    }
    const script = document.createElement("script")
    script.src = "https://www.youtube.com/iframe_api"
    script.async = true
    script.onerror = () => {
      embedScript = null
      reject(new Error("Failed to load the YouTube embed script"))
    }
    document.head.appendChild(script)
  })
  return embedScript
}

type Props = {
  /** "left"/"right" for the two-runner layout, or any unique key when `win` is given. */
  side: string
  /** Window to render into; defaults to the two-runner window for `side`. */
  win?: WindowRect
  /** Player name used in the audio badge's accessible label. */
  label?: string
  config: VodConfig
  layout: VodFrameLayout
  onAutoMute: () => void
  /** Make this runner the only one with audio. */
  onSelectAudio: () => void
  onVolumeChange: (volume: number) => void
  /** Lift this player above the settings panel while it is being edited. */
  raised?: boolean
}

/**
 * Twitch keeps its original, proven player untouched; YouTube gets its own so changes
 * for one provider can never affect how the other starts playback.
 */
export const VodPlayer = forwardRef<VodPlayerHandle, Props>(function VodPlayer(props, ref) {
  if (props.config.platform === "youtube") return <YouTubeVodPlayer key="youtube" ref={ref} {...props} />
  return <TwitchVodPlayer key="twitch" ref={ref} {...props} />
})

const EDGE_OVERSCAN_PX = 3

// YouTube letterboxes inside a non-16:9 iframe, so the iframe stays 16:9 and a scaleY
// transform stretches it to a cropped layout's height.
function overscan(layout: VodFrameLayout): React.CSSProperties {
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

const AUTOPLAY_CHECK_MS = 1200
const MAX_PLAY_ATTEMPTS = 4
const YT_PLAYING = 1
const YT_BUFFERING = 3

const YouTubeVodPlayer = forwardRef<VodPlayerHandle, Props>(function YouTubeVodPlayer(
  { side, win: winProp, label, config, layout, onAutoMute, onSelectAudio, onVolumeChange, raised = false },
  ref,
) {
  const mountId = `youtube-vod-${side}-${useId().replace(/[^a-zA-Z0-9]/g, "")}`
  const hostRef = useRef<HTMLDivElement>(null)
  const playerRef = useRef<YouTubePlayer | null>(null)
  const readyRef = useRef(false)
  const pendingPlayRef = useRef(false)
  const latest = useRef(config)
  latest.current = config
  const onAutoMuteRef = useRef(onAutoMute)
  onAutoMuteRef.current = onAutoMute

  function attemptPlay(player: YouTubePlayer, attempt = 0) {
    const startedAt = player.getCurrentTime()
    player.playVideo()
    window.setTimeout(() => {
      if (playerRef.current !== player || !pendingPlayRef.current) return
      if (player.getCurrentTime() - startedAt > 0.25) return
      if (attempt >= MAX_PLAY_ATTEMPTS) return
      // Browsers block unmuted autoplay without a gesture; muted playback is always allowed.
      if (attempt === 0 && !player.isMuted()) {
        player.mute()
        onAutoMuteRef.current()
      }
      attemptPlay(player, attempt + 1)
    }, AUTOPLAY_CHECK_MS)
  }

  const { videoId, loadKey, muted, volume } = config

  useEffect(() => {
    const host = hostRef.current
    if (!host || !videoId) return
    let cancelled = false

    const mount = document.createElement("div")
    mount.id = mountId
    mount.style.width = "100%"
    mount.style.height = "100%"
    host.replaceChildren(mount)

    loadYouTubeEmbed()
      .then(() => {
        if (cancelled || !window.YT) return
        const player = new window.YT.Player(mountId, {
          width: "100%",
          height: "100%",
          videoId,
          playerVars: {
            autoplay: 0,
            mute: latest.current.muted ? 1 : 0,
            start: Math.floor(latest.current.startSeconds),
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            iv_load_policy: 3,
            modestbranding: 1,
            rel: 0,
          },
          events: {
            onReady: () => {
              if (cancelled) return
              readyRef.current = true
              player.setVolume(Math.round(latest.current.volume * 100))
              if (latest.current.muted) player.mute()
              if (pendingPlayRef.current) attemptPlay(player)
            },
          },
        })
        playerRef.current = player
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
    const player = playerRef.current
    if (!player || !readyRef.current) return
    if (muted) player.mute()
    else player.unMute()
  }, [muted])

  useEffect(() => {
    if (readyRef.current) playerRef.current?.setVolume(Math.round(volume * 100))
  }, [volume])

  const [volumeOpen, setVolumeOpen] = useState(false)
  const audioRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!volumeOpen) return
    const close = (e: PointerEvent) => {
      if (!audioRef.current?.contains(e.target as Node)) setVolumeOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setVolumeOpen(false)
    }
    document.addEventListener("pointerdown", close)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("pointerdown", close)
      document.removeEventListener("keydown", onKey)
    }
  }, [volumeOpen])

  useImperativeHandle(ref, () => ({
    play: () => {
      pendingPlayRef.current = true
      const player = playerRef.current
      if (player && readyRef.current) attemptPlay(player)
    },
    pause: () => {
      pendingPlayRef.current = false
      if (readyRef.current) playerRef.current?.pauseVideo()
    },
    seekTo: (seconds) => {
      if (readyRef.current) playerRef.current?.seekTo(Math.max(0, seconds), true)
    },
    nudge: (seconds) => {
      const player = playerRef.current
      if (player && readyRef.current) player.seekTo(Math.max(0, player.getCurrentTime() + seconds), true)
    },
    getCurrentTime: () => (readyRef.current ? (playerRef.current?.getCurrentTime() ?? null) : null),
    isPaused: () => {
      const player = playerRef.current
      if (!player || !readyRef.current) return true
      const state = player.getPlayerState()
      return state !== YT_PLAYING && state !== YT_BUFFERING
    },
  }))

  if (!videoId) return null

  const win = winProp ?? VOD_WINDOWS[side as VodSide]
  const playerName = label ?? (side === "right" ? "Player 2" : "Player 1")

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
      <div ref={hostRef} className="vod-frame" style={overscan(layout)} />
      {config.crop && (
        <div
          className="vod-crop-mask"
          aria-hidden="true"
          style={{
            left: "50%",
            top: "50%",
            width: (config.crop.x1 - config.crop.x0) * layout.width,
            height: (config.crop.y1 - config.crop.y0) * layout.height,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}
      <div ref={audioRef} className={`vod-audio vod-audio-${side}`}>
        {volumeOpen && (
          <div className="vod-volume-pop">
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={`${playerName} volume`}
              onChange={(e) => onVolumeChange(Number(e.target.value))}
            />
            <span className="vod-volume-value">{Math.round(volume * 100)}</span>
          </div>
        )}
        <button
          type="button"
          className={`vod-audio-badge${muted ? " vod-audio-badge-muted" : ""}`}
          aria-label={muted ? `Switch to ${playerName} audio` : `Listening to ${playerName} audio`}
          aria-expanded={volumeOpen}
          title="Click: listen to this runner. Right-click: volume"
          onClick={() => onSelectAudio()}
          onContextMenu={(e) => {
            e.preventDefault()
            e.stopPropagation()
            setVolumeOpen((open) => !open)
          }}
        >
          <Music aria-hidden="true" />
        </button>
      </div>
    </div>
  )
})
