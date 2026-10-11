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

export type PanelStyle = "column" | "wide" | "bar"

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

// Player cells form a 2x2 grid between two-brick-wide side borders, with no top or bottom border
// row; the top cells sit flush with the stage top, a single brick row divides the halves, and the
// panel is a single brick-tall bar flush with the bottom.
export const QUAD_LAYOUT = buildLayout(
  [brickRect(2, 0, 18, 10), brickRect(21, 0, 18, 10), brickRect(2, 11, 18, 10), brickRect(21, 11, 18, 10)],
  brickRect(2, 22, 37, 1),
  "bar",
  ["left", "right", "left", "right"],
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
 * neighbor's window. When two Twitch frames would touch, the frame first slides away from the
 * neighbor as far as it can while the chosen crop stays fully inside its window, and only zooms
 * out (about the crop) by the minimum needed when sliding alone isn't enough.
 */
export function resolveQuadLayouts(windows: WindowRect[], configs: VodConfig[], fill = true): VodFrameLayout[] {
  return configs.map((config, i) => {
    const own = windows[i]
    const frame = frameInWindow(own, config, fill)
    let x: Span = { start: own.left + frame.left, size: frame.width }
    let y: Span = { start: own.top + frame.top, size: frame.height }
    const ownX: Span = { start: own.left, size: own.width }
    const ownY: Span = { start: own.top, size: own.height }
    const isTwitch = config.platform === "twitch"

    if (hasSource(config) && isTwitch) {
      configs.forEach((other, j) => {
        if (j === i || !hasSource(other) || other.platform !== "twitch") return
        const win = windows[j]
        const overlapsX = x.start < win.left + win.width && x.start + x.size > win.left
        const overlapsY = y.start < win.top + win.height && y.start + y.size > win.top
        if (!overlapsX || !overlapsY) return

        const free: Bounds = { lo: -Infinity, hi: Infinity }
        const options: { axis: "x" | "y"; bounds: Bounds }[] = []
        if (win.left >= own.left + own.width) options.push({ axis: "x", bounds: { lo: -Infinity, hi: win.left } })
        if (win.left + win.width <= own.left) options.push({ axis: "x", bounds: { lo: win.left + win.width, hi: Infinity } })
        if (win.top >= own.top + own.height) options.push({ axis: "y", bounds: { lo: -Infinity, hi: win.top } })
        if (win.top + win.height <= own.top) options.push({ axis: "y", bounds: { lo: win.top + win.height, hi: Infinity } })

        const fits = options.map((o) => ({
          axis: o.axis,
          main: o.axis === "x" ? fitAxis(x, ownX, o.bounds) : fitAxis(y, ownY, o.bounds),
        }))
        const best = fits.sort((a, b) => b.main.scale - a.main.scale)[0]
        if (!best) return
        // Scale the other axis the same amount where possible so the picture keeps its shape.
        const crossFit =
          best.axis === "x"
            ? fitAxis(y, ownY, free, best.main.scale, best.main.scale)
            : fitAxis(x, ownX, free, best.main.scale, best.main.scale)
        if (best.axis === "x") {
          x = { start: best.main.start, size: best.main.size }
          y = { start: crossFit.start, size: crossFit.size }
        } else {
          y = { start: best.main.start, size: best.main.size }
          x = { start: crossFit.start, size: crossFit.size }
        }
      })
    }

    return { left: x.start - own.left, top: y.start - own.top, width: x.size, height: y.size, onTop: isTwitch }
  })
}
