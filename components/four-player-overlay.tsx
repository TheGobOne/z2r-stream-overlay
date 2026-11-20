"use client"

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { VodPlayer, type VodPlayerHandle } from "@/components/vod-player"
import { SeriesPips } from "@/components/series-pips"
import { ARCADE_COLORS, ARCADE_YELLOW, ArcadeFrame, ArcadeSky } from "@/components/arcade-decor"
import { AudioBadge } from "@/components/audio-badge"
import { useFitFontSize } from "@/lib/use-fit-font"
import { PlaceBadge, type Placements } from "@/components/place-badge"
import { createVodConfig, hasSource, type VodConfig, type WindowRect } from "@/lib/vod"
import { BRICK_W, QUAD_TRACKER_WIDTH, betterArrangement, resolveQuadLayouts, type GridLayout } from "@/lib/quad"
import "./four-player-overlay.css"
import dynamic from "next/dynamic"

// Tools-window only; kept out of the overlay bundle that every OBS source loads
const PlayerTools = dynamic(() => import("@/components/player-tools").then((m) => m.PlayerTools), { ssr: false })

type TrackerIcon = { id: string; src: string; alt: string }

export type QuadOverlayHandle = {
  playAll(): void
  pauseAll(): void
  /** Pause every video and send it back to its start time. */
  resetAll(): void
  /** Fill runner names and live Twitch channels, in order. */
  setRunners(runners: ({ name: string; channel: string | null } | undefined)[]): void
  /** The players by slot (null while one is not mounted), for saving where each VOD is. */
  players(): (VodPlayerHandle | null)[]
  /** Unmute these players and mute the rest. */
  listenTo(indexes: number[]): void
  /** One player's audio level, 0 to 1. */
  setVolume(index: number, value: number): void
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
  onClearItemBadge: (itemId: string) => void
  linkToTimer: boolean
  onLinkToTimerChange: (value: boolean) => void
  /** Race info, commentary, tracking and the timer; each layout arranges these its own way. */
  /** Chat command help that slides up over the side panel now and then; null when chat tracking is off. */
  chatHelp?: ReactNode
  /** 4 player rails: the chat2r note over the right rail while `chatHelp` (the commands) covers the left rail. */
  chatHelpInfo?: ReactNode
  sidePanel: { info: ReactNode; commentary: ReactNode; tracking: ReactNode; status: ReactNode }
  onSidePanelContextMenu: (e: React.MouseEvent) => void
  /** Slot in the tools window where this overlay's video controls render; null while it's closed. */
  toolsSlot: HTMLElement | null
  /** Called from a right-click so the browser allows (re)opening the tools window. */
  onRequestTools: () => void
  placements: Placements
  onNamesChange?: (names: string[]) => void
  /** Per runner, ids greyed out; held by the page so the tools window can edit them too. */
  notCollected: Set<string>[]
  notDefeated: Set<string>[]
  onToggleItem: (runner: number, itemId: string) => void
  onToggleBoss: (runner: number, bossId: string) => void
  /** Series games won per runner and the wins needed (0 hides the squares). */
  seriesWins: number[]
  seriesToWin: number
  /** Draw the Arcade look (starfield, coloured frames) instead of the brick art. */
  arcade?: boolean
  /** Two 1v1s: a VS badge on the seam between P1 and P2, and between P3 and P4. */
  pairs?: boolean
  /** Names and videos to start with, e.g. restored after a reload. Read once on mount. */
  initial?: { names: string[]; vods: VodConfig[] }
  /** Every change to the videos, so the page can save them. */
  onVodsChange?: (vods: VodConfig[]) => void
  /** Runners moved slots: order[slot] is the runner (old slot) now there. The page moves its per-runner state to match. */
  onArrange?: (order: number[]) => void
}

// Hitbox strips sit on the bricks around a loaded video; half a brick keeps neighbors from overlapping

const rect = (r: WindowRect) => ({ left: r.left, top: r.top, width: r.width, height: r.height })

// 8px is the smallest the pixel font stays readable on stream
const QUAD_NAME_FIT = { base: 13, min: 8, letterSpacing: 1 }

/** A runner name sized to the plate it sits in (column trackers are much narrower than rails). */
function QuadNameInput({ value, onChange, index }: { value: string; onChange: (value: string) => void; index: number }) {
  const ref = useRef<HTMLInputElement>(null)
  const size = useFitFontSize(ref, value, QUAD_NAME_FIT)
  return (
    <input
      ref={ref}
      type="text"
      className="zelda-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`PLAYER ${index + 1}`}
      maxLength={16}
      aria-label={`Player ${index + 1} name`}
      spellCheck={false}
      autoComplete="off"
      style={{ "--zelda-font-size": `${size}px` } as React.CSSProperties}
    />
  )
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
    onClearItemBadge,
    linkToTimer,
    onLinkToTimerChange,
    sidePanel,
    chatHelp,
    chatHelpInfo,
    onSidePanelContextMenu,
    toolsSlot,
    onRequestTools,
    placements,
    onNamesChange,
    notCollected,
    notDefeated,
    onToggleItem,
    onToggleBoss,
    seriesWins,
    seriesToWin,
    arcade = false,
    pairs = false,
    onArrange,
    initial,
    onVodsChange,
  },
  ref,
) {
  const { count, cells, windows, panel, panelStyle, defaultZoom, rails } = layout
  const [names, setNames] = useState(() => Array.from({ length: count }, (_, i) => initial?.names[i] ?? ""))
  const [vods, setVods] = useState<VodConfig[]>(() =>
    Array.from({ length: count }, (_, i) => initial?.vods[i] ?? { ...createVodConfig(), zoom: defaultZoom }),
  )
  const onVodsChangeRef = useRef(onVodsChange)
  onVodsChangeRef.current = onVodsChange
  useEffect(() => onVodsChangeRef.current?.(vods), [vods])
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

  function resetAll() {
    pauseAll()
    playerRefs.forEach((r, i) => r.current?.seekTo(vods[i].startSeconds))
  }

  /** Fills names and live Twitch channels in order; a runner without a channel keeps their current video. */
  function setRunners(runners: ({ name: string; channel: string | null } | undefined)[]) {
    const nextNames = Array.from({ length: count }, (_, i) => runners[i]?.name ?? names[i])
    setNames(nextNames)
    onNamesChange?.(nextNames)
    setVods((prev) =>
      prev.map((config, i) => {
        const channel = runners[i]?.channel
        if (!channel) return config
        return { ...config, url: `https://twitch.tv/${channel}`, platform: "twitch", videoId: null, channel, startSeconds: 0, loadKey: config.loadKey + 1 }
      }),
    )
  }

  useImperativeHandle(ref, () => ({
    playAll,
    pauseAll,
    resetAll,
    setRunners,
    players: () => playerRefs.map((r) => r.current),
    listenTo: (indexes) => setVods((prev) => prev.map((config, j) => ({ ...config, muted: !indexes.includes(j) }))),
    setVolume: (index, value) => setVods((prev) => prev.map((config, j) => (j === index ? { ...config, volume: value } : config))),
  }))

  function openPanel(index: number, e: React.MouseEvent) {
    e.preventDefault()
    setSelected(index)
    onRequestTools()
  }

  const fillCrop = true
  const labelFor = (i: number) => names[i] || `Player ${i + 1}`
  // Up to 24 orders x 24 stackings with bisection; only redo it when a frame's shape or place can change,
  // not on volume drags, mute, or a resume point (those fields never reach the layout math)
  const layoutKey = JSON.stringify(
    vods.map(({ muted: _m, volume: _v, audioBad: _a, resumeSeconds: _r, loadKey: _l, startSeconds: _s, url: _u, ...shape }) => shape),
  )
  /* eslint-disable react-hooks/exhaustive-deps */
  const layouts = useMemo(() => resolveQuadLayouts(windows, vods, fillCrop), [windows, layoutKey, fillCrop])
  const arrangement = useMemo(() => betterArrangement(windows, vods, fillCrop, pairs), [windows, layoutKey, fillCrop, pairs])
  /* eslint-enable react-hooks/exhaustive-deps */

  /** Moves each runner, with their video, crop and trackers, into the slot `order` gives them. */
  function arrange(order: number[]) {
    // A VOD picks up where it was; a live stream just reconnects
    const times = playerRefs.map((r) => r.current?.getCurrentTime() ?? null)
    const playing = playerRefs.map((r) => r.current != null && !r.current.isPaused())
    const nextNames = order.map((r) => names[r])
    setNames(nextNames)
    onNamesChange?.(nextNames)
    setVods((prev) =>
      order.map((r) => {
        const config = prev[r]
        const time = times[r]
        // Pick up where it was without moving the start point that resets go back to
        return config.videoId && time !== null ? { ...config, resumeSeconds: Math.floor(time) } : config
      }),
    )
    // The moved players reload; a play asked for now carries over to the new player (PLAY_CARRY_MS)
    order.forEach((r, slot) => {
      if (playing[r]) playerRefs[slot].current?.play()
    })
    setSelected(order.indexOf(selected))
    onArrange?.(order)
  }

  const squeezeNotice = (() => {
    if (!arrangement) return null
    const moved = arrangement.order.map((r, slot) => (r !== slot ? slot : -1)).filter((slot) => slot >= 0)
    const who = moved.map((slot) => labelFor(slot))
    const text =
      moved.length === 2
        ? `${who[0]} and ${who[1]} squeeze each other's game. Swap their slots so ${arrangement.fixesAll ? "both games show full size" : "the games show bigger"}.`
        : `Some games are squeezed by their neighbors. Rearranging slots ${arrangement.fixesAll ? "shows every game full size" : "shows the games bigger"}.`
    return (
      <div className="tools-squeeze" role="status">
        <p>{text}</p>
        <button type="button" className="vod-btn vod-btn-primary" onClick={() => arrange(arrangement.order)}>
          {moved.length === 2 ? "Swap slots" : "Rearrange slots"}
        </button>
      </div>
    )
  })()

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
            className={`quad-name${seriesToWin > 0 ? " has-pips" : ""}${hasSource(vods[i]) ? " has-audio" : ""}`}
            style={{ ["--pc" as string]: ARCADE_COLORS[i] }}
            onContextMenu={(e) => {
              if (hasSource(vods[i])) openPanel(i, e)
            }}
          >
            <SeriesPips wins={seriesWins[i] ?? 0} toWin={seriesToWin} />
            <QuadNameInput
              index={i}
              value={names[i]}
              onChange={(value) => {
                const next = names.map((n, j) => (j === i ? value : n))
                setNames(next)
                onNamesChange?.(next)
              }}
            />
            {hasSource(vods[i]) && (
              <AudioBadge
                playerName={labelFor(i)}
                muted={vods[i].muted}
                onSelectAudio={() => setVods((prev) => prev.map((config, j) => ({ ...config, muted: j !== i })))}
              />
            )}
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
                  onClick={() => onToggleBoss(i, boss.id)}
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
                  onClick={() => onToggleItem(i, item.id)}
                  onContextMenu={(e) => e.preventDefault()}
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
              {chatHelpInfo ? chatHelp : null}
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
              {chatHelpInfo ?? chatHelp}
            </div>
          ),
        },
      ]
    : []

  return (
    <>

      {arcade ? (
        <div className="arcade-decor" aria-hidden="true" style={{ position: "absolute", inset: 0 }}>
          <ArcadeSky />
          {cells.map((cell, i) => (
            <ArcadeFrame key={i} box={cell} color={ARCADE_COLORS[i]} pad={5} />
          ))}
          {rails ? (
            <>
              <ArcadeFrame box={rails.left} color={ARCADE_COLORS[0]} pad={5} />
              <ArcadeFrame box={rails.right} color={ARCADE_COLORS[1]} pad={5} />
            </>
          ) : (
            <ArcadeFrame box={panel} color={ARCADE_YELLOW} pad={5} />
          )}
        </div>
      ) : (
        <div className="quad-bricks" aria-hidden="true" />
      )}
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
          config={config}
          layout={layouts[i]}
          maskAtCrop
              onAutoMute={() => updateVod(i, { muted: true })}
        />
      ))}

      {windows.map((win, i) => (
        <PlaceBadge key={i} place={placements[i]} win={win} edge="top" />
      ))}

      {pairs &&
        windows.length === 4 &&
        [
          [windows[0], windows[1]],
          [windows[2], windows[3]],
        ].map(([a, b], row) => (
          <div
            key={`vs-${row}`}
            className="quad-vs"
            aria-hidden="true"
            style={{ left: (a.left + a.width + b.left) / 2, top: a.top + a.height / 2 }}
          >
            VS
          </div>
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
          {/* The arcade look draws a line in each runner's color where their tracker meets the middle block (see overlay.css) */}
          <div className="quad-runner quad-runner-top" style={{ ["--pc" as string]: ARCADE_COLORS[runners[0]] }}>{renderRunner(runners[0], true)}</div>
          {middle}
          <div className="quad-runner quad-runner-bottom" style={{ ["--pc" as string]: ARCADE_COLORS[runners[1]] }}>{renderRunner(runners[1], true)}</div>
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
            notice={squeezeNotice}
          />,
          toolsSlot,
        )}

      {!rails && (
      <div
        className={`quad-side quad-side-${panelStyle}`}
        // Reach 1px up and left so neighboring brick highlights can't bleed through fractional edges
        style={{ left: panel.left - 1, top: panel.top - 1, width: panel.width + 1, height: panel.height + 1 }}
        onContextMenu={onSidePanelContextMenu}
      >
        {sidePanel.info}
        {sidePanel.commentary}
        {sidePanel.tracking}
        {sidePanel.status}
        {chatHelp}
      </div>
      )}
    </>
  )
})
