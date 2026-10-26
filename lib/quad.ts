import { frameInWindow, hasSource, type VodConfig, type VodFrameLayout, type WindowRect } from "@/lib/vod"

// The 1456x816 stage is laid out on a 41x23 grid of bricks (each ~35.5px, near-square)
// so every border and divider is exactly one whole brick thick.
export const STAGE_WIDTH = 1456
export const STAGE_HEIGHT = 816
export const BRICK_COLS = 41
export const BRICK_ROWS = 23
export const BRICK_W = STAGE_WIDTH / BRICK_COLS
export const BRICK_H = STAGE_HEIGHT / BRICK_ROWS

// Exactly four bricks wide so each tracker lines up with the brick columns above and below it.
export const QUAD_TRACKER_WIDTH = 4 * BRICK_W

function brickRect(col: number, row: number, cols: number, rows: number): WindowRect {
  return { left: col * BRICK_W, top: row * BRICK_H, width: cols * BRICK_W, height: rows * BRICK_H }
}

export type PanelStyle = "column" | "wide" | "bar" | "rails"

export type GridLayout = {
  count: number
  cells: WindowRect[]
  windows: WindowRect[]
  panel: WindowRect
  /** column: tall side strip; wide: a quadrant with grouped sections; bar: one thin row along the bottom. */
  panelStyle: PanelStyle
  /** Stretch crops to fill each window; when false, crops keep their aspect with black bars. */
  stretchCrop?: boolean
  /** Which side of each cell's video its tracker column sits on. */
  trackerSides: TrackerSide[]
  /** "rails" layouts: full-height black columns either side of the windows (P1/P3 on the left, P2/P4 on the right). */
  rails?: { left: WindowRect; right: WindowRect }
  dock: WindowRect
  defaultZoom: number
}

export type TrackerSide = "left" | "right"

function buildLayout(
  cells: WindowRect[],
  panel: WindowRect,
  panelStyle: PanelStyle,
  trackerSides: TrackerSide[] = cells.map(() => "right"),
): GridLayout {
  // Each cell's tracker column sits beside its video, so a zoomed frame can spill
  // sideways under the tracker and divider without ever reaching the next player's video.
  const windows = cells.map((cell, i) => ({
    left: trackerSides[i] === "left" ? cell.left + QUAD_TRACKER_WIDTH : cell.left,
    top: cell.top,
    width: cell.width - QUAD_TRACKER_WIDTH,
    height: cell.height,
  }))
  return {
    count: cells.length,
    cells,
    windows,
    trackerSides,
    panel,
    panelStyle,
    // The settings panel is centered over the top row, at the same size as the two-runner panel
    dock: {
      left: (cells[0].left + cells[1].left + cells[1].width - 655) / 2,
      top: (STAGE_HEIGHT - 511) / 2,
      width: 655,
      height: 511,
    },
    // Zoom at which a 16:9 video exactly fills the window's height
    defaultZoom: Math.round((windows[0].height / ((windows[0].width * 9) / 16)) * 100) / 100,
  }
}

function buildRailLayout(windows: WindowRect[], rails: { left: WindowRect; right: WindowRect }): GridLayout {
  return {
    count: windows.length,
    // The windows sit directly on the bricks, so each one is its own black backing cell.
    cells: windows,
    windows,
    trackerSides: windows.map(() => "right"),
    panel: rails.right,
    panelStyle: "rails",
    rails,
    dock: {
      left: (windows[0].left + windows[1].left + windows[1].width - 655) / 2,
      top: (STAGE_HEIGHT - 511) / 2,
      width: 655,
      height: 511,
    },
    defaultZoom: Math.round((windows[0].height / ((windows[0].width * 9) / 16)) * 100) / 100,
  }
}

// Wide Quad: four 12x10-brick windows in the middle, one brick apart, with a six-brick black rail on
// each side. Each rail holds two runners' name and trackers (P1/P3 left, P2/P4 right) around a block
// of race info on the left and commentary, tracking and the timer on the right.
export const QUAD_LAYOUT = buildRailLayout(
  [brickRect(8, 1, 12, 10), brickRect(21, 1, 12, 10), brickRect(8, 12, 12, 10), brickRect(21, 12, 12, 10)],
  { left: brickRect(1, 1, 6, 21), right: brickRect(34, 1, 6, 21) },
)

// Players 1 and 2 split the top half, player 3 takes the bottom-left quadrant and the panel the bottom-right.
export const TRIO_LAYOUT = buildLayout(
  [brickRect(1, 1, 18, 10), brickRect(22, 1, 18, 10), brickRect(1, 12, 18, 10)],
  brickRect(22, 12, 18, 10),
  "wide",
  ["left", "right", "left"],
)

type Span = { start: number; size: number }
type Bounds = { lo: number; hi: number }

/**
 * Valid frame starts on one axis at `scale`: the frame must cover its window, stay inside
 * `bounds` (clear of a Twitch neighbor), and keep the originally visible area `[c0, c1]`
 * (video fractions) inside the window. Returns null when no start satisfies all three.
 */
function startRange(frame: Span, win: Span, c0: number, c1: number, bounds: Bounds, scale: number) {
  const size = frame.size * scale
  const winEnd = win.start + win.size
  const min = Math.max(winEnd - size, win.start - c0 * size, bounds.lo)
  const max = Math.min(win.start, winEnd - c1 * size, bounds.hi - size)
  return min <= max + 1e-6 ? { min, max: Math.max(min, max), size } : null
}

/** Largest scale (≤ `cap`) at which the axis has a valid start, placed as close to centered as possible. */
function fitAxis(frame: Span, win: Span, bounds: Bounds, floor = 0, cap = 1): Span & { scale: number } {
  const c0 = (win.start - frame.start) / frame.size
  const c1 = (win.start + win.size - frame.start) / frame.size
  const minScale = Math.max(floor, win.size / frame.size)
  let scale = Math.min(cap, 1)
  if (!startRange(frame, win, c0, c1, bounds, scale)) {
    let lo = minScale
    let hi = scale
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2
      if (startRange(frame, win, c0, c1, bounds, mid)) lo = mid
      else hi = mid
    }
    scale = lo
  }
  const range = startRange(frame, win, c0, c1, bounds, scale) ?? { min: win.start, max: win.start, size: win.size }
  const centered = win.start + win.size / 2 - ((c0 + c1) / 2) * range.size
  const start = Math.min(range.max, Math.max(range.min, centered))
  return { start, size: range.size, scale: range.size / frame.size }
}

/**
 * Twitch pauses any embed whose iframe rect is covered, even where it's clipped away; YouTube
 * doesn't care. Twitch frames stack above YouTube ones, so a frame may freely overlap a YouTube
 * neighbor's window. Like the 2-player layout, Twitch frames are stacked by how far they spill
 * out of their windows: the top frame is never adjusted, and a lower frame only has to stay clear
 * of the windows of the Twitch frames above it (their overflow is clipped, so it covers nothing).
 * A lower frame first slides as far as it can while its crop stays fully inside its window, and
 * only zooms out (about the crop) by the minimum needed when sliding alone isn't enough.
 */
export function resolveQuadLayouts(windows: WindowRect[], configs: VodConfig[], fill = true): VodFrameLayout[] {
  const frames = configs.map((config, i) => {
    const own = windows[i]
    const frame = frameInWindow(own, config, fill)
    return {
      x: { start: own.left + frame.left, size: frame.width } as Span,
      y: { start: own.top + frame.top, size: frame.height } as Span,
    }
  })
  const isLiveTwitch = configs.map((c) => hasSource(c) && c.platform === "twitch")
  const overflow = (i: number) => {
    const w = windows[i]
    const { x, y } = frames[i]
    return (
      Math.max(0, w.left - x.start) +
      Math.max(0, x.start + x.size - (w.left + w.width)) +
      Math.max(0, w.top - y.start) +
      Math.max(0, y.start + y.size - (w.top + w.height))
    )
  }
  // Top of the stack first.
  const stack = configs
    .map((_, i) => i)
    .filter((i) => isLiveTwitch[i])
    .sort((a, b) => overflow(b) - overflow(a) || a - b)

  stack.forEach((i, depth) => {
    const own = windows[i]
    let { x, y } = frames[i]
    const ownX: Span = { start: own.left, size: own.width }
    const ownY: Span = { start: own.top, size: own.height }
    {
      // Limits from every Twitch window above are combined before fitting, so satisfying one
      // can never push the frame back into another.
      const bx: Bounds = { lo: -Infinity, hi: Infinity }
      const by: Bounds = { lo: -Infinity, hi: Infinity }
      const within = (span: Span, b: Bounds) => span.start >= b.lo - 1e-6 && span.start + span.size <= b.hi + 1e-6
      const ownRight = own.left + own.width
      const ownBottom = own.top + own.height

      stack.slice(0, depth).forEach((j) => {
        const win = windows[j]
        const options: { axis: "x" | "y"; bounds: Bounds }[] = []
        if (win.left >= ownRight) options.push({ axis: "x", bounds: { lo: -Infinity, hi: win.left } })
        if (win.left + win.width <= own.left) options.push({ axis: "x", bounds: { lo: win.left + win.width, hi: Infinity } })
        if (win.top >= ownBottom) options.push({ axis: "y", bounds: { lo: -Infinity, hi: win.top } })
        if (win.top + win.height <= own.top) options.push({ axis: "y", bounds: { lo: win.top + win.height, hi: Infinity } })

        const merged = options.map((o) => {
          const cur = o.axis === "x" ? bx : by
          return { axis: o.axis, bounds: { lo: Math.max(cur.lo, o.bounds.lo), hi: Math.min(cur.hi, o.bounds.hi) } }
        })
        // Already clear of this neighbor on some axis: no new limit needed.
        if (merged.some((o) => within(o.axis === "x" ? x : y, o.bounds))) return
        const best = merged
          .map((o) => ({ ...o, scale: (o.axis === "x" ? fitAxis(x, ownX, o.bounds) : fitAxis(y, ownY, o.bounds)).scale }))
          .sort((a, b) => b.scale - a.scale)[0]
        if (!best) return
        Object.assign(best.axis === "x" ? bx : by, best.bounds)
      })

      if (!within(x, bx) || !within(y, by)) {
        // Zoom both axes by the same amount so the picture keeps its shape.
        const scale = Math.min(fitAxis(x, ownX, bx).scale, fitAxis(y, ownY, by).scale)
        const fx = fitAxis(x, ownX, bx, scale, scale)
        const fy = fitAxis(y, ownY, by, scale, scale)
        x = { start: fx.start, size: fx.size }
        y = { start: fy.start, size: fy.size }
      }
    }
    frames[i] = { x, y }
  })

  return configs.map((config, i) => {
    const own = windows[i]
    const { x, y } = frames[i]
    const depth = stack.indexOf(i)
    return {
      left: x.start - own.left,
      top: y.start - own.top,
      width: x.size,
      height: y.size,
      onTop: config.platform === "twitch",
      z: depth >= 0 ? QUAD_TWITCH_Z + stack.length - 1 - depth : undefined,
    }
  })
}

/** Twitch frames take z-indexes from here up, one per frame, below the place badges. */
const QUAD_TWITCH_Z = 14
