"use client"

import { forwardRef, useCallback, useImperativeHandle, useRef, useState, type ReactNode } from "react"
import { TwitchVodPlayer, type VodPlayerHandle } from "@/components/twitch-vod-player"
import { VodPanel } from "@/components/vod-panel"
import { VodCropSelector } from "@/components/vod-crop-selector"
import { createVodConfig, hasSource, UNCROPPED_VIEW, type VodConfig, type WindowRect } from "@/lib/vod"
import {
  BRICK_H,
  BRICK_W,
  QUAD_CELLS,
  QUAD_COUNT,
  QUAD_DEFAULT_ZOOM,
  QUAD_PANEL,
  QUAD_PANEL_DOCK,
  QUAD_TRACKER_WIDTH,
  QUAD_WINDOWS,
  resolveQuadLayouts,
} from "@/lib/quad"

type TrackerIcon = { id: string; src: string; alt: string }

export type QuadOverlayHandle = {
  playAll(): void
  pauseAll(): void
}

type Props = {
  bosses: TrackerIcon[]
  items: TrackerIcon[]
  bossBadges: Record<string, number>
  bossBadgeLabels: string[]
  itemBadges: Record<string, string>
  onBossContextMenu: (bossId: string) => void
  onClearBossBadge: (bossId: string) => void
  onItemContextMenu: (e: React.MouseEvent, itemId: string, type: "number" | "letter") => void
  onClearItemBadge: (itemId: string) => void
  linkToTimer: boolean
  onLinkToTimerChange: (value: boolean) => void
  /** Commentary, tracking, timer and anything else shown in the right-hand column. */
  sidePanel: ReactNode
  onSidePanelContextMenu: (e: React.MouseEvent) => void
}

// Hitbox strips sit on the bricks around a loaded video; half a brick keeps neighbors from overlapping
// The first row of items uses number/code badges; the rest use letter badges
const NUMBER_BADGE_ITEMS = 8

const rect = (r: WindowRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height })

function nameFontSize(name: string) {
  const length = name.length || "PLAYER 1".length
  if (length <= 6) return 13
  if (length <= 8) return 11
  if (length <= 11) return 8
  return 6
}

function toggleIn(sets: Set<string>[], index: number, id: string) {
  return sets.map((set, i) => {
    if (i !== index) return set
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}

export const FourPlayerOverlay = forwardRef<QuadOverlayHandle, Props>(function FourPlayerOverlay(
  {
    bosses,
    items,
    bossBadges,
    bossBadgeLabels,
    itemBadges,
    onBossContextMenu,
    onClearBossBadge,
    onItemContextMenu,
    onClearItemBadge,
    linkToTimer,
    onLinkToTimerChange,
    sidePanel,
    onSidePanelContextMenu,
  },
  ref,
) {
  const [names, setNames] = useState(() => Array<string>(QUAD_COUNT).fill(""))
  const [vods, setVods] = useState<VodConfig[]>(() =>
    Array.from({ length: QUAD_COUNT }, () => ({ ...createVodConfig(), zoom: QUAD_DEFAULT_ZOOM })),
  )
  // Ids in these sets are greyed out; clicking an icon lights it up
  const [notCollected, setNotCollected] = useState(() =>
    Array.from({ length: QUAD_COUNT }, () => new Set(items.map((item) => item.id))),
  )
  const [notDefeated, setNotDefeated] = useState(() =>
    Array.from({ length: QUAD_COUNT }, () => new Set(bosses.map((boss) => boss.id))),
  )
  const [panelIndex, setPanelIndex] = useState<number | null>(null)
  const [cropMode, setCropMode] = useState(false)

  const ref0 = useRef<VodPlayerHandle>(null)
  const ref1 = useRef<VodPlayerHandle>(null)
  const ref2 = useRef<VodPlayerHandle>(null)
  const ref3 = useRef<VodPlayerHandle>(null)
  const playerRefs = [ref0, ref1, ref2, ref3]

  function updateVod(index: number, patch: Partial<VodConfig>) {
    setVods((prev) => prev.map((config, i) => (i === index ? { ...config, ...patch } : config)))
  }

  const closePanel = useCallback(() => {
    setPanelIndex(null)
    setCropMode(false)
  }, [])

  function playAll() {
    // Twitch refuses to play embeds that are covered, and the panel covers the player grid
    const panelWasOpen = panelIndex !== null
    closePanel()
    window.setTimeout(() => playerRefs.forEach((r) => r.current?.play()), panelWasOpen ? 100 : 0)
  }

  function pauseAll() {
    playerRefs.forEach((r) => r.current?.pause())
  }

  useImperativeHandle(ref, () => ({ playAll, pauseAll }))

  function openPanel(index: number, e: React.MouseEvent) {
    e.preventDefault()
    setCropMode(false)
    setPanelIndex(index)
  }

  const croppingIndex = panelIndex !== null && cropMode && hasSource(vods[panelIndex]) ? panelIndex : null
  const layouts = resolveQuadLayouts(
    vods.map((config, i) => (i === croppingIndex ? { ...config, ...UNCROPPED_VIEW } : config)),
  )
  const labelFor = (i: number) => names[i] || `Player ${i + 1}`

  return (
    <>
      <style>{`
        .quad-bricks {
          position: absolute;
          inset: 0;
          background-image: url('/overlays/brick-tile.png');
          background-size: ${BRICK_W}px ${BRICK_H}px;
          image-rendering: pixelated;
          pointer-events: none;
        }

        .quad-cell {
          position: absolute;
          background: #000000;
        }

        .quad-side {
          position: absolute;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          padding: 20px 10px;
          background: #000000;
          font-family: 'ZeldaII', monospace;
        }

        .quad-side .commentary-input,
        .quad-side .tracking-input {
          width: 100%;
          box-sizing: border-box;
        }

        .quad-side-title {
          margin: 12px 0 2px;
          font-size: 13px;
          letter-spacing: 1px;
          color: #ffd700;
          text-decoration: underline;
          text-transform: uppercase;
          user-select: none;
        }

        .quad-side .quad-side-input {
          height: 26px;
          font-size: 12px;
        }

        .quad-side .quad-side-timer {
          position: static;
          transform: none;
          margin-top: 24px;
          padding: 0;
          background: none;
          border: none;
          font-size: 20px;
        }

        .quad-side-gem {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-top: auto;
          padding: 0;
          background: none;
          border: none;
          color: #ffffff;
          font-family: inherit;
          font-size: 20px;
          cursor: pointer;
        }

        .quad-side-gem img {
          width: 40px;
          height: 40px;
          image-rendering: pixelated;
        }

        .quad-tracker {
          position: absolute;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
  justify-content: flex-start;
  padding: 6px;
  }

  .quad-tracker > .quad-grid { margin-top: auto; }
  .quad-tracker > .quad-grid:last-child { margin-bottom: auto; }

        .quad-name {
          position: relative;
          box-sizing: border-box;
          width: 100%;
          height: 40px;
          flex-shrink: 0;
          background: #000000;
          border: 3px solid #3050f8;
          outline: 2px solid #ffffff;
          outline-offset: -1px;
        }

        .quad-name::before, .quad-name::after {
          content: "";
          position: absolute;
          top: -5px;
          width: 6px;
          height: 6px;
          background: #d82800;
          box-shadow: 0 34px 0 #d82800;
        }

        .quad-name::before { left: -5px; }
        .quad-name::after { right: -5px; }

        .quad-name .zelda-input {
          line-height: 34px;
          top: -2px;
          padding: 0 4px;
          letter-spacing: 1px;
        }

        .quad-grid {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 3px;
          width: ${4 * 30 + 3 * 3}px;
        }

        .quad-grid > button {
          width: 30px;
          height: 30px;
        }

        .quad-tracker .boss-btn img,
        .quad-tracker .item-btn img {
          width: 30px;
          height: 30px;
        }

        .quad-tracker .boss-badge,
        .quad-tracker .item-badge.num-badge {
          font-size: 10px;
        }
      `}</style>

      <div className="quad-bricks" aria-hidden="true" />
      {QUAD_CELLS.map((cell, i) => (
        <div key={i} className="quad-cell" style={rect(cell)} aria-hidden="true" />
      ))}

      {vods.map((config, i) => (
        <TwitchVodPlayer
          key={i}
          ref={playerRefs[i]}
          side={`quad-${i}`}
          win={QUAD_WINDOWS[i]}
          label={labelFor(i)}
          config={config}
          layout={layouts[i]}
          onAutoMute={() => updateVod(i, { muted: true })}
        />
      ))}

      {QUAD_CELLS.map((cell, i) => (
        <div
          key={i}
          className="quad-tracker"
          style={{
            left: cell.left + cell.width - QUAD_TRACKER_WIDTH,
            top: cell.top,
            width: QUAD_TRACKER_WIDTH,
            height: cell.height,
          }}
        >
          <div
            className="quad-name"
            onContextMenu={(e) => {
              if (hasSource(vods[i])) openPanel(i, e)
            }}
          >
            <input
              type="text"
              className="zelda-input"
              value={names[i]}
              onChange={(e) => setNames((prev) => prev.map((n, j) => (j === i ? e.target.value : n)))}
              placeholder={`PLAYER ${i + 1}`}
              aria-label={`Player ${i + 1} name`}
              spellCheck={false}
              autoComplete="off"
              style={{ "--zelda-font-size": `${nameFontSize(names[i])}px` } as React.CSSProperties}
            />
          </div>

          <div className="quad-grid" role="group" aria-label={`${labelFor(i)} boss tracker`}>
            {bosses.map((boss) => {
              const off = notDefeated[i].has(boss.id)
              const badge = bossBadges[boss.id]
              return (
                <button
                  key={boss.id}
                  className={`boss-btn ${off ? "defeated" : "active"}`}
                  onClick={() => setNotDefeated((prev) => toggleIn(prev, i, boss.id))}
                  onContextMenu={(e) => {
                    e.preventDefault()
                    onBossContextMenu(boss.id)
                  }}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      onClearBossBadge(boss.id)
                    }
                  }}
                  aria-label={`${boss.alt} — ${off ? "alive" : "defeated"}`}
                  title={boss.alt}
                >
                  <img src={boss.src || "/placeholder.svg"} alt="" />
                  {badge !== undefined && <span className="boss-badge">{bossBadgeLabels[badge]}</span>}
                </button>
              )
            })}
          </div>

          <div className="quad-grid" role="group" aria-label={`${labelFor(i)} item tracker`}>
            {items.map((item, index) => {
              const off = notCollected[i].has(item.id)
              const badge = itemBadges[item.id]
              return (
                <button
                  key={item.id}
                  className={`item-btn ${off ? "collected" : "active"}`}
                  onClick={() => setNotCollected((prev) => toggleIn(prev, i, item.id))}
                  onContextMenu={(e) => onItemContextMenu(e, item.id, index < NUMBER_BADGE_ITEMS ? "number" : "letter")}
                  onAuxClick={(e) => {
                    if (e.button === 1) {
                      e.preventDefault()
                      onClearItemBadge(item.id)
                    }
                  }}
                  aria-label={`${item.alt} — ${off ? "not collected" : "collected"}`}
                  title={item.alt}
                >
                  <img src={item.src || "/placeholder.svg"} alt="" />
                  {badge !== undefined && <span className="item-badge num-badge">{badge}</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {/* Right-click an empty game window (or the bricks around a loaded one) to set up that player's VOD.
          Nothing may cover a loaded VOD during playback, so the full-window hitbox only exists for empty windows. */}
      {QUAD_WINDOWS.map((win, i) => {
        if (croppingIndex === i) {
          return (
            <VodCropSelector
              key={i}
              win={win}
              frame={layouts[i]}
              onApply={(view) => {
                updateVod(i, view)
                setCropMode(false)
              }}
              onCancel={() => setCropMode(false)}
            />
          )
        }
        if (hasSource(vods[i])) return null
        return (
          <div
            key={i}
            className="vod-hitbox"
            style={rect(win)}
            onContextMenu={(e) => openPanel(i, e)}
            aria-hidden="true"
          />
        )
      })}

      {panelIndex !== null && croppingIndex === null && (
        <VodPanel
          key={panelIndex}
          side={`quad-${panelIndex}`}
          dock={QUAD_PANEL_DOCK}
          defaultZoom={QUAD_DEFAULT_ZOOM}
          groupLabel="all"
          playerLabel={labelFor(panelIndex)}
          config={vods[panelIndex]}
          onChange={(patch) => updateVod(panelIndex, patch)}
          playerRef={playerRefs[panelIndex]}
          cropMode={cropMode}
          onCropModeChange={setCropMode}
          linkToTimer={linkToTimer}
          onLinkToTimerChange={onLinkToTimerChange}
          onPlayBoth={playAll}
          onPauseBoth={pauseAll}
          onClose={closePanel}
        />
      )}

      <div className="quad-side" style={rect(QUAD_PANEL)} onContextMenu={onSidePanelContextMenu}>
        {sidePanel}
      </div>
    </>
  )
})
