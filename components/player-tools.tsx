"use client"

import { useEffect, useState, type RefObject } from "react"
import { getParentDomains, type VodPlayerHandle } from "@/components/twitch-vod-player"
import { VodPanel } from "@/components/vod-panel"
import { VodCropSelector } from "@/components/vod-crop-selector"
import { frameInWindow, toTwitchTime, UNCROPPED_VIEW, type VodConfig, type WindowRect } from "@/lib/vod"

export type ToolsPlayer = {
  label: string
  config: VodConfig
  onChange: (patch: Partial<VodConfig>) => void
  playerRef: RefObject<VodPlayerHandle | null>
  /** The player's real window on the overlay, which the crop is saved for. */
  cropTarget: WindowRect
}

type Props = {
  /** Unique prefix for element ids. */
  id: string
  players: ToolsPlayer[]
  selected: number
  onSelect: (index: number) => void
  defaultZoom?: number
  groupLabel: string
  /** Stretch crops to fill the window; otherwise keep their aspect with black bars. */
  fillCrop?: boolean
  linkToTimer: boolean
  onLinkToTimerChange: (value: boolean) => void
  onPlayAll: () => void
  onPauseAll: () => void
}

const PREVIEW_WINDOW: WindowRect = { left: 0, top: 0, width: 768, height: 432 }
const PREVIEW_LAYOUT = { ...frameInWindow(PREVIEW_WINDOW, UNCROPPED_VIEW), onTop: true }

function previewSrc(config: VodConfig, startSeconds: number) {
  if (config.platform === "youtube") {
    const params = new URLSearchParams({
      autoplay: "1",
      mute: "1",
      start: String(Math.floor(startSeconds)),
      controls: "0",
      disablekb: "1",
      modestbranding: "1",
      rel: "0",
      playsinline: "1",
    })
    return `https://www.youtube.com/embed/${config.videoId}?${params}`
  }
  const params = new URLSearchParams({ autoplay: "true", muted: "true", controls: "false" })
  if (config.videoId) {
    params.set("video", `v${config.videoId}`)
    params.set("time", toTwitchTime(startSeconds))
  } else if (config.channel) {
    params.set("channel", config.channel)
  }
  getParentDomains().forEach((host) => params.append("parent", host))
  return `https://player.twitch.tv/?${params}`
}

/** A private, muted copy of the video where the crop is picked, so the live overlay never shows it uncropped. */
function CropPreview({
  player,
  fill,
  onDone,
}: {
  player: ToolsPlayer
  fill: boolean
  onDone: () => void
}) {
  const [startAt] = useState(() => player.playerRef.current?.getCurrentTime() ?? player.config.startSeconds)

  return (
    <div className="tools-crop">
      <p className="tools-crop-title">Crop {player.label}</p>
      <div className="tools-crop-stage" style={{ width: PREVIEW_WINDOW.width, height: PREVIEW_WINDOW.height }}>
        <iframe
          className="tools-crop-video"
          src={previewSrc(player.config, startAt)}
          title={`${player.label} crop preview`}
          allow="autoplay; encrypted-media"
        />
        <VodCropSelector
          win={PREVIEW_WINDOW}
          frame={PREVIEW_LAYOUT}
          target={player.cropTarget}
          fill={fill}
          onApply={(view) => {
            player.onChange(view)
            onDone()
          }}
          onCancel={onDone}
        />
      </div>
    </div>
  )
}

export function PlayerTools({
  id,
  players,
  selected,
  onSelect,
  defaultZoom,
  groupLabel,
  fillCrop = true,
  linkToTimer,
  onLinkToTimerChange,
  onPlayAll,
  onPauseAll,
}: Props) {
  const [cropMode, setCropMode] = useState(false)
  const index = Math.min(selected, players.length - 1)
  const player = players[index]
  useEffect(() => setCropMode(false), [index])

  return (
    <section className="tools-card" aria-labelledby={`${id}-players-title`}>
      <h2 id={`${id}-players-title`} className="tools-card-title">
        Videos
      </h2>
      <div className="tools-tabs" role="tablist" aria-label="Players">
        {players.map((p, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            id={`${id}-tab-${i}`}
            aria-selected={i === index}
            aria-controls={`${id}-tabpanel`}
            className="tools-tab"
            onClick={() => onSelect(i)}
          >
            {p.label}
            {(p.config.videoId || p.config.channel) && <span className="tools-tab-dot" aria-label="(video loaded)" />}
          </button>
        ))}
      </div>

      <div id={`${id}-tabpanel`} role="tabpanel" aria-labelledby={`${id}-tab-${index}`}>
        {cropMode && (player.config.videoId || player.config.channel) ? (
          <CropPreview key={`${index}-${player.config.loadKey}`} player={player} fill={fillCrop} onDone={() => setCropMode(false)} />
        ) : (
          <VodPanel
            key={index}
            inline
            side={`${id}-${index}`}
            defaultZoom={defaultZoom}
            groupLabel={groupLabel}
            playerLabel={player.label}
            config={player.config}
            onChange={player.onChange}
            playerRef={player.playerRef}
            cropMode={cropMode}
            onCropModeChange={setCropMode}
            linkToTimer={linkToTimer}
            onLinkToTimerChange={onLinkToTimerChange}
            onPlayBoth={onPlayAll}
            onPauseBoth={onPauseAll}
          />
        )}
      </div>
    </section>
  )
}
