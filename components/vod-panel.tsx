"use client"

import { useEffect, useState, type RefObject } from "react"
import type { VodPlayerHandle } from "@/components/twitch-vod-player"
import {
  clamp,
  createVodConfig,
  DEFAULT_ZOOM,
  formatTime,
  MAX_ZOOM,
  MIN_ZOOM,
  parseTime,
  parseTwitchVod,
  VOD_WINDOWS,
  type VodConfig,
  type VodSide,
} from "@/lib/vod"

type Props = {
  side: VodSide
  playerLabel: string
  config: VodConfig
  onChange: (patch: Partial<VodConfig>) => void
  playerRef: RefObject<VodPlayerHandle | null>
  cropMode: boolean
  onCropModeChange: (value: boolean) => void
  linkToTimer: boolean
  onLinkToTimerChange: (value: boolean) => void
  onPlayBoth: () => void
  onPauseBoth: () => void
  onClose: () => void
}

const NUDGES = [-10, -1, 1, 10]

export function VodPanel({
  side,
  playerLabel,
  config,
  onChange,
  playerRef,
  cropMode,
  onCropModeChange,
  linkToTimer,
  onLinkToTimerChange,
  onPlayBoth,
  onPauseBoth,
  onClose,
}: Props) {
  const [urlDraft, setUrlDraft] = useState(config.url)
  const [startDraft, setStartDraft] = useState(config.videoId ? formatTime(config.startSeconds) : "")
  const [error, setError] = useState("")
  const [currentTime, setCurrentTime] = useState<number | null>(null)
  const [paused, setPaused] = useState(true)

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(playerRef.current?.getCurrentTime() ?? null)
      setPaused(playerRef.current?.isPaused() ?? true)
    }, 250)
    return () => clearInterval(id)
  }, [playerRef])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  function loadVod() {
    const parsed = parseTwitchVod(urlDraft)
    if (!parsed) {
      setError("Paste a twitch.tv/videos/... link")
      return
    }
    const typedStart = startDraft.trim() ? parseTime(startDraft) : null
    if (startDraft.trim() && typedStart === null) {
      setError("Start time should look like 1:02:03")
      return
    }
    const startSeconds = typedStart ?? parsed.startSeconds ?? 0
    setError("")
    setStartDraft(formatTime(startSeconds))
    onChange({
      url: urlDraft.trim(),
      videoId: parsed.videoId,
      startSeconds,
      loadKey: config.loadKey + 1,
    })
  }

  function onEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return
    loadVod()
  }

  function setStartHere() {
    if (currentTime === null) return
    onChange({ startSeconds: currentTime })
    setStartDraft(formatTime(currentTime))
  }

  function removeVod() {
    const fresh = createVodConfig()
    onChange({ ...fresh, loadKey: config.loadKey + 1 })
    setUrlDraft("")
    setStartDraft("")
  }

  const hasVod = Boolean(config.videoId)
  const ready = hasVod && currentTime !== null
  const dock = VOD_WINDOWS[side]

  return (
    <div
      className="vod-panel"
      role="dialog"
      aria-labelledby={`vod-panel-title-${side}`}
      style={{ left: dock.left, top: dock.top, width: dock.width, height: dock.height }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="vod-panel-header">
        <p id={`vod-panel-title-${side}`} className="vod-panel-title">
          {playerLabel} VOD
        </p>
        <button className="vod-btn" onClick={onClose}>
          Done
        </button>
      </div>

      <div className="vod-panel-section">
        <label className="vod-label" htmlFor={`vod-url-${side}`}>
          Twitch VOD link
        </label>
        <input
          id={`vod-url-${side}`}
          className="vod-input"
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onKeyDown={onEnter}
          placeholder="twitch.tv/videos/123456789"
          spellCheck={false}
          autoComplete="off"
          autoFocus
        />
        <div className="vod-row">
          <label className="vod-label" htmlFor={`vod-start-${side}`}>
            Start
          </label>
          <input
            id={`vod-start-${side}`}
            className="vod-input vod-input-time"
            value={startDraft}
            onChange={(e) => setStartDraft(e.target.value)}
            onKeyDown={onEnter}
            placeholder="0:00:00"
            spellCheck={false}
            autoComplete="off"
          />
          <button className="vod-btn vod-btn-primary" onClick={loadVod}>
            {hasVod ? "Reload" : "Load"}
          </button>
          {hasVod && (
            <button className="vod-btn" onClick={removeVod}>
              Remove
            </button>
          )}
        </div>
        {error && (
          <p className="vod-error" role="alert">
            {error}
          </p>
        )}
      </div>

      {hasVod && (
        <>
          <div className="vod-panel-section">
            <p className="vod-label">
              Playback <span className="vod-time">{ready ? formatTime(currentTime) : "loading..."}</span>
            </p>
            <div className="vod-row">
              {NUDGES.slice(0, 2).map((n) => (
                <button key={n} className="vod-btn" disabled={!ready} onClick={() => playerRef.current?.nudge(n)}>
                  {n}s
                </button>
              ))}
              <button
                className="vod-btn vod-btn-primary vod-btn-wide"
                disabled={!ready}
                onClick={() => (paused ? playerRef.current?.play() : playerRef.current?.pause())}
              >
                {paused ? "Play" : "Pause"}
              </button>
              {NUDGES.slice(2).map((n) => (
                <button key={n} className="vod-btn" disabled={!ready} onClick={() => playerRef.current?.nudge(n)}>
                  +{n}s
                </button>
              ))}
            </div>
            <div className="vod-row">
              <button
                className="vod-btn"
                disabled={!ready}
                onClick={() => playerRef.current?.seekTo(config.startSeconds)}
              >
                Go to start
              </button>
              <button className="vod-btn" disabled={!ready} onClick={setStartHere}>
                Set start here
              </button>
            </div>
          </div>

          <div className="vod-panel-section">
            <p className="vod-label">Crop</p>
            <label className="vod-check">
              <input type="checkbox" checked={cropMode} onChange={(e) => onCropModeChange(e.target.checked)} />
              Crop mode <span className="vod-hint">drag the video to move, scroll to zoom (pauses playback)</span>
            </label>
            <div className="vod-row">
              <button
                className="vod-btn"
                aria-label="Zoom out"
                onClick={() => onChange({ zoom: clamp(config.zoom / 1.1, MIN_ZOOM, MAX_ZOOM) })}
              >
                -
              </button>
              <span className="vod-value">{Math.round(config.zoom * 100)}%</span>
              <button
                className="vod-btn"
                aria-label="Zoom in"
                onClick={() => onChange({ zoom: clamp(config.zoom * 1.1, MIN_ZOOM, MAX_ZOOM) })}
              >
                +
              </button>
              <button
                className="vod-btn"
                onClick={() => onChange({ zoom: DEFAULT_ZOOM, centerX: 0.5, centerY: 0.5 })}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="vod-panel-section">
            <div className="vod-row">
              <button className="vod-btn" onClick={() => onChange({ muted: !config.muted })}>
                {config.muted ? "Unmute" : "Mute"}
              </button>
              <input
                type="range"
                className="vod-range"
                min={0}
                max={1}
                step={0.05}
                value={config.volume}
                onChange={(e) => onChange({ volume: Number(e.target.value) })}
                aria-label="Volume"
              />
              <span className="vod-value">{Math.round(config.volume * 100)}%</span>
            </div>
            <p className="vod-hint">
              Twitch controls work directly on the video. Right-click the frame around it to reopen this panel.
            </p>
          </div>
        </>
      )}

      <div className="vod-panel-footer">
        <button className="vod-btn" onClick={onPlayBoth}>
          Play both
        </button>
        <button className="vod-btn" onClick={onPauseBoth}>
          Pause both
        </button>
        <label className="vod-check">
          <input type="checkbox" checked={linkToTimer} onChange={(e) => onLinkToTimerChange(e.target.checked)} />
          Sync with timer
        </label>
      </div>
    </div>
  )
}
