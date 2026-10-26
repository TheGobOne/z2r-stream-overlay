"use client"

import { forwardRef, useImperativeHandle, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { VodPlayer, type VodPlayerHandle } from "@/components/vod-player"
import { PlayerTools } from "@/components/player-tools"
import { PlaceBadge, type Placements } from "@/components/place-badge"
import { createVodConfig, hasSource, type VodConfig, type WindowRect } from "@/lib/vod"
import { BRICK_H, BRICK_W, QUAD_TRACKER_WIDTH, resolveQuadLayouts, type GridLayout } from "@/lib/quad"

type TrackerIcon = { id: string; src: string; alt: string }

export type QuadOverlayHandle = {
  playAll(): void
  pauseAll(): void
}

type Props = {
  layout: GridLayout
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
  /** Race info, commentary, tracking and the timer; each layout arranges these its own way. */
  sidePanel: { info: ReactNode; commentary: ReactNode; tracking: ReactNode; status: ReactNode }
  onSidePanelContextMenu: (e: React.MouseEvent) => void
  /** Slot in the tools window where this overlay's video controls render; null while it's closed. */
  toolsSlot: HTMLElement | null
  /** Called from a right-click so the browser allows (re)opening the tools window. */
  onRequestTools: () => void
  placements: Placements
  onNamesChange?: (names: string[]) => void
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
    layout,
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
    toolsSlot,
    onRequestTools,
    placements,
    onNamesChange,
  },
  ref,
) {
  const { count, cells, windows, panel, panelStyle, defaultZoom, rails } = layout
  const [names, setNames] = useState(() => Array<string>(count).fill(""))
  const [vods, setVods] = useState<VodConfig[]>(() =>
    Array.from({ length: count }, () => ({ ...createVodConfig(), zoom: defaultZoom })),
  )
  // Ids in these sets are greyed out; clicking an icon lights it up
  const [notCollected, setNotCollected] = useState(() =>
    Array.from({ length: count }, () => new Set(items.map((item) => item.id))),
  )
  const [notDefeated, setNotDefeated] = useState(() =>
    Array.from({ length: count }, () => new Set(bosses.map((boss) => boss.id))),
  )
  const [selected, setSelected] = useState(0)

  const ref0 = useRef<VodPlayerHandle>(null)
  const ref1 = useRef<VodPlayerHandle>(null)
  const ref2 = useRef<VodPlayerHandle>(null)
  const ref3 = useRef<VodPlayerHandle>(null)
  const playerRefs = [ref0, ref1, ref2, ref3].slice(0, count)

  function updateVod(index: number, patch: Partial<VodConfig>) {
    setVods((prev) => prev.map((config, i) => (i === index ? { ...config, ...patch } : config)))
  }

  function playAll() {
    playerRefs.forEach((r) => r.current?.play())
  }

  function pauseAll() {
    playerRefs.forEach((r) => r.current?.pause())
  }

  useImperativeHandle(ref, () => ({ playAll, pauseAll }))

  function openPanel(index: number, e: React.MouseEvent) {
    e.preventDefault()
    setSelected(index)
    onRequestTools()
  }

  const fillCrop = layout.stretchCrop ?? true
  const layouts = resolveQuadLayouts(windows, vods, fillCrop)
  const labelFor = (i: number) => names[i] || `Player ${i + 1}`

  // With a crop, the black bar beside the picture joins the tracker column, so center the tracker in that space
  const trackerLeft = (i: number) => {
    const cell = cells[i]
    const maxLeft = cell.left + cell.width - QUAD_TRACKER_WIDTH
    return Math.min(maxLeft, Math.max(cell.left, Math.round(rawTrackerLeft(i) / BRICK_W) * BRICK_W))
  }

  const rawTrackerLeft = (i: number) => {
    const cell = cells[i]
    const cellRight = cell.left + cell.width
    const onLeft = layout.trackerSides[i] === "left"
    const fallback = onLeft ? cell.left : cellRight - QUAD_TRACKER_WIDTH
    const crop = vods[i].crop
    if (!crop || !hasSource(vods[i])) return fallback
    const frame = layouts[i]
    if (onLeft) {
      const cropLeft = Math.min(windows[i].width, Math.max(0, frame.left + crop.x0 * frame.width))
      const spaceRight = windows[i].left + cropLeft
      return Math.max(fallback, cell.left + (spaceRight - cell.left - QUAD_TRACKER_WIDTH) / 2)
    }
    const cropRight = Math.min(windows[i].width, Math.max(0, frame.left + crop.x1 * frame.width))
    const spaceLeft = windows[i].left + cropRight
    return Math.min(fallback, spaceLeft + (cellRight - spaceLeft - QUAD_TRACKER_WIDTH) / 2)
  }

  const hasThunderbird = bosses.some((boss) => boss.id === "thunderbird")

  // One runner's name plate and trackers; `rail` swaps the grid widths for the Wide Quad rails
  const renderRunner = (i: number, rail: boolean) => (
    <>
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
              onChange={(e) => {
                const next = names.map((n, j) => (j === i ? e.target.value : n))
                setNames(next)
                onNamesChange?.(next)
              }}
              placeholder={`PLAYER ${i + 1}`}
              aria-label={`Player ${i + 1} name`}
              spellCheck={false}
              autoComplete="off"
              style={{ "--zelda-font-size": `${nameFontSize(names[i])}px` } as React.CSSProperties}
            />
          </div>

          <div
                className={`quad-grid${rail ? (hasThunderbird ? " quad-grid-boss-wrap" : "") : hasThunderbird ? "" : " quad-grid-3"}`}
                role="group"
                aria-label={`${labelFor(i)} boss tracker`}
              >
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
    </>
  )

  const railSides = rails
    ? [
        {
          rect: rails.left,
          runners: [0, 2],
          middle: (
            <div className="quad-rail-middle" onContextMenu={onSidePanelContextMenu}>
              <p className="quad-side-title">Race info</p>
              {sidePanel.info}
            </div>
          ),
        },
        {
          rect: rails.right,
          runners: [1, 3],
          middle: (
            <div className="quad-rail-middle" onContextMenu={onSidePanelContextMenu}>
              {sidePanel.commentary}
              {sidePanel.tracking}
              {sidePanel.status}
            </div>
          ),
        },
      ]
    : []

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

        .quad-side-group {
          display: contents;
        }

        .quad-side:not(.quad-side-wide):not(.quad-side-bar) {
          justify-content: space-evenly;
          gap: 0;
        }

        .quad-side:not(.quad-side-wide):not(.quad-side-bar) .quad-side-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .quad-side-info-input {
          width: 100%;
          box-sizing: border-box;
          padding: 10px 4px;
          margin-bottom: 8px;
          resize: none;
          overflow: hidden;
          field-sizing: content;
          min-height: 5em;
          background: transparent;
          border: 2px solid rgba(255, 215, 0, 0.45);
          border-radius: 2px;
          color: #ffd700;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
          letter-spacing: 1px;
          text-align: center;
          text-transform: uppercase;
          outline: none;
        }

        .quad-side-info-input::placeholder {
          color: rgba(255, 215, 0, 0.4);
        }

        .quad-side-info-input:focus {
          border-color: #ffd700;
        }

        .quad-side.quad-side-wide {
          display: grid;
          grid-template-columns: 1fr 1fr;
          grid-template-rows: auto auto 1fr;
          grid-template-areas:
            "info info"
            "commentary tracking"
            "status status";
          align-items: start;
          column-gap: 28px;
          row-gap: 12px;
          padding: 16px 28px 20px;
        }

        .quad-side-wide .quad-side-info {
          grid-area: info;
        }

        .quad-side-wide .quad-side-commentary {
          grid-area: commentary;
        }

        .quad-side-wide .quad-side-tracking {
          grid-area: tracking;
        }

        .quad-side-wide .quad-side-info-input {
          font-size: 26px;
          min-height: 3.9em;
          margin-bottom: 0;
        }

        .quad-side-wide .quad-side-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
        }

        .quad-side-wide .quad-side-status {
          grid-area: status;
          flex-direction: row;
          justify-content: center;
          align-self: center;
          gap: 48px;
        }

        .quad-side-wide .quad-side-title {
          font-size: 16px;
        }

        .quad-side.quad-side-wide .quad-side-input {
          height: 32px;
          font-size: 15px;
        }

        .quad-side.quad-side-wide .quad-side-timer {
          margin-top: 0;
          font-size: 36px;
        }

        .quad-side-wide .quad-side-gem {
          margin-top: 0;
          font-size: 28px;
        }

        .quad-side-wide .quad-side-gem img {
          width: 52px;
          height: 52px;
        }

        .quad-side .commentary-input,
        .quad-side .tracking-input {
          width: 100%;
          box-sizing: border-box;
        }

        .quad-side.quad-side-bar {
          flex-direction: row;
          align-items: center;
          gap: 24px;
          padding: 0 16px;
        }

        .quad-side-bar .quad-side-group {
          display: flex;
          flex-direction: row;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .quad-side-bar .quad-side-info {
          flex: 1.4;
        }

        .quad-side-bar .quad-side-commentary {
          flex: 1.6;
        }

        .single-com .quad-side-bar .quad-side-commentary {
          justify-content: center;
        }

        .single-com .quad-side.quad-side-bar .quad-side-commentary .commentary-input {
          flex: 0 1 180px;
        }

        .quad-side-bar .quad-side-tracking {
          flex: 1;
        }

        .quad-side-bar .quad-side-status {
          flex: none;
          gap: 16px;
        }

        .quad-side-bar .quad-side-info-input {
          field-sizing: fixed;
          min-height: 0;
          height: 26px;
          margin: 0;
          padding: 0 8px 6px;
          font-size: 13px;
          line-height: 16px;
          white-space: nowrap;
        }

        /* ZeldaII draws glyphs on the baseline with a tall ascent, so text sits ~3px low; nudge it up to center the ink. */
        .quad-side-bar .quad-side-title {
          flex: none;
          margin: 0;
          position: relative;
          top: -3px;
        }

        .quad-side.quad-side-bar .commentary-input,
        .quad-side.quad-side-bar .tracking-input {
          flex: 1;
          width: auto;
          min-width: 0;
          padding-top: 0;
          padding-bottom: 6px;
        }

        .quad-side.quad-side-bar .quad-side-timer {
          position: relative;
          top: -3px;
          left: auto;
          right: auto;
          bottom: auto;
          margin-top: 0;
          font-size: 13px;
          line-height: 1;
        }

        .quad-side-bar .quad-side-gem {
          margin-top: 0;
          font-size: 18px;
        }

        .quad-side-bar .quad-side-gem img {
          width: 26px;
          height: 26px;
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
          margin-top: 16px;
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
  padding: 6px 5px;
  z-index: 15;
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

        .quad-grid.quad-grid-3 {
          width: ${3 * 30 + 2 * 3}px;
        }

        .quad-grid > button {
          width: 30px;
          height: 30px;
        }

        .quad-rail {
          position: absolute;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: space-between;
          padding: 10px 6px;
          background: #000000;
          font-family: 'ZeldaII', monospace;
          z-index: 15;
        }

        .quad-runner {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        /* Race info and the broadcast block share one height so the two rails read as a matched pair. */
        .quad-rail-middle {
          flex: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          height: 200px;
        }

        .quad-rail-middle .quad-side-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 8px;
          width: 100%;
        }

        .quad-rail .quad-side-title {
          margin: 0;
        }

        .quad-rail .quad-side-input {
          height: 26px;
          font-size: 12px;
          text-align: center;
        }

        .quad-rail .commentary-input,
        .quad-rail .tracking-input {
          width: 100%;
          box-sizing: border-box;
          text-align: center;
        }

        .quad-rail-middle .quad-side-info {
          flex: 1;
          min-height: 0;
          justify-content: center;
          box-sizing: border-box;
          border: 2px solid rgba(255, 215, 0, 0.45);
          border-radius: 2px;
          padding: 4px;
        }

        .quad-rail-middle .quad-side-info:focus-within {
          border-color: #ffd700;
        }

        .quad-rail .quad-side-info-input {
          field-sizing: content;
          min-height: 0;
          max-height: 100%;
          margin: 0;
          padding: 0;
          border: none;
          font-size: 14px;
          line-height: 1.5;
        }

        .quad-rail .quad-side-status {
          gap: 6px;
        }

        .quad-rail .quad-side-timer {
          position: static;
          transform: none;
          margin: 0;
          padding: 0 0 0 2px;
          background: none;
          border: none;
          font-size: 26px;
          line-height: 1.1;
          text-align: center;
        }

        .quad-rail .quad-side-gem {
          margin-top: 0;
          font-size: 22px;
        }

        .quad-rail .quad-side-gem img {
          width: 32px;
          height: 32px;
        }

        .quad-rail .quad-name {
          height: 36px;
        }

        .quad-rail .quad-name .zelda-input {
          line-height: 30px;
        }

        .quad-rail .quad-grid {
          width: ${6 * 30 + 5 * 3}px;
        }

        .quad-rail .quad-grid.quad-grid-boss-wrap {
          width: ${4 * 30 + 3 * 3}px;
        }

        .quad-rail .boss-btn img,
        .quad-rail .item-btn img {
          width: 30px;
          height: 30px;
        }

        .quad-rail .boss-badge,
        .quad-rail .item-badge.num-badge {
          font-size: 10px;
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
      {cells.map((cell, i) => (
          // Cells start on fractional pixels; reach 1px up and left so neighboring brick highlights can't bleed through
          <div
            key={i}
            className="quad-cell"
            style={{ left: cell.left - 1, top: cell.top - 1, width: cell.width + 1, height: cell.height + 1 }}
            aria-hidden="true"
          />
      ))}

      {vods.map((config, i) => (
        <VodPlayer
          key={i}
          ref={playerRefs[i]}
          side={`quad-${i}`}
          win={windows[i]}
          label={labelFor(i)}
          config={config}
          layout={layouts[i]}
              onAutoMute={() => updateVod(i, { muted: true })}
              onSelectAudio={() => setVods((prev) => prev.map((config, j) => ({ ...config, muted: j !== i })))}
              onVolumeChange={(volume) => updateVod(i, { volume })}
        />
      ))}

      {windows.map((win, i) => (
        <PlaceBadge key={i} place={placements[i]} win={win} />
      ))}

      {!rails &&
        cells.map((cell, i) => (
          <div
            key={i}
            className="quad-tracker"
            style={{ left: trackerLeft(i), top: cell.top, width: QUAD_TRACKER_WIDTH, height: cell.height }}
          >
            {renderRunner(i, false)}
          </div>
        ))}

      {railSides.map(({ rect: r, runners, middle }, k) => (
        <div
          key={k}
          className="quad-rail"
          style={{ left: r.left - 1, top: r.top - 1, width: r.width + 1, height: r.height + 1 }}
        >
          <div className="quad-runner">{renderRunner(runners[0], true)}</div>
          {middle}
          <div className="quad-runner">{renderRunner(runners[1], true)}</div>
        </div>
      ))}

      {/* Right-click an empty game window (or the bricks around a loaded one) to set up that player's VOD.
          Nothing may cover a loaded VOD during playback, so the full-window hitbox only exists for empty windows. */}
      {windows.map((win, i) => {
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

      {toolsSlot &&
        createPortal(
          <PlayerTools
            id="quad-tools"
            players={vods.map((config, i) => ({
              label: labelFor(i),
              config,
              onChange: (patch) => updateVod(i, patch),
              playerRef: playerRefs[i],
              cropTarget: windows[i],
            }))}
            selected={selected}
            onSelect={setSelected}
            defaultZoom={defaultZoom}
            groupLabel="all"
            fillCrop={fillCrop}
            linkToTimer={linkToTimer}
            onLinkToTimerChange={onLinkToTimerChange}
            onPlayAll={playAll}
            onPauseAll={pauseAll}
          />,
          toolsSlot,
        )}

      {!rails && (
      <div
        className={`quad-side${panelStyle === "column" ? "" : ` quad-side-${panelStyle}`}`}
        // Reach 1px up and left so neighboring brick highlights can't bleed through fractional edges
        style={{ left: panel.left - 1, top: panel.top - 1, width: panel.width + 1, height: panel.height + 1 }}
        onContextMenu={onSidePanelContextMenu}
      >
        {sidePanel.info}
        {sidePanel.commentary}
        {sidePanel.tracking}
        {sidePanel.status}
      </div>
      )}
    </>
  )
})
