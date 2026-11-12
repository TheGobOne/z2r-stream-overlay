"use client"

import { useEffect, useRef, useState } from "react"
import { Music } from "lucide-react"

type Props = {
  playerName: string
  muted: boolean
  volume: number
  /** Make this runner the only one with audio. */
  onSelectAudio: () => void
  onVolumeChange: (volume: number) => void
}

/**
 * Audio badge shown inside a runner's name plate. It used to sit over the video, but Twitch
 * refuses script play() while any element covers its iframe, so it lives outside the video now.
 */
export function AudioBadge({ playerName, muted, volume, onSelectAudio, onVolumeChange }: Props) {
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

  return (
    <div ref={audioRef} className="vod-audio">
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
  )
}
