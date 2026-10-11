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
)

/**
 * Twitch pauses any embed whose iframe rect is covered, even where it's clipped away; YouTube
 * doesn't care. Twitch frames stack above YouTube ones, so a frame may overlap a neighbor's
 * window unless both are Twitch. Only then is it pushed back toward its own outer edge, along
 * whichever axis needs the least shift, which moves the picture off the chosen crop.
 */
export function resolveQuadLayouts(windows: WindowRect[], configs: VodConfig[], fill = true): VodFrameLayout[] {
  return configs.map((config, i) => {
    const own = windows[i]
    const frame = frameInWindow(own, config, fill)
    let left = own.left + frame.left
    let top = own.top + frame.top
    const { width, height } = frame
    const isTwitch = config.platform === "twitch"

    if (hasSource(config) && isTwitch) {
      configs.forEach((other, j) => {
        if (j === i || !hasSource(other) || other.platform !== "twitch") return
        const win = windows[j]
        const overlapsX = left < win.left + win.width && left + width > win.left
        const overlapsY = top < win.top + win.height && top + height > win.top
        if (!overlapsX || !overlapsY) return

        const pushes: { axis: "x" | "y"; to: number }[] = []
        if (win.left >= own.left + own.width) pushes.push({ axis: "x", to: win.left - width })
        if (win.left + win.width <= own.left) pushes.push({ axis: "x", to: win.left + win.width })
        if (win.top >= own.top + own.height) pushes.push({ axis: "y", to: win.top - height })
        if (win.top + win.height <= own.top) pushes.push({ axis: "y", to: win.top + win.height })

        const shift = (p: (typeof pushes)[number]) => Math.abs(p.to - (p.axis === "x" ? left : top))
        const best = pushes.sort((a, b) => shift(a) - shift(b))[0]
        if (!best) return
        if (best.axis === "x") left = best.to
        else top = best.to
      })
    }

    return { left: left - own.left, top: top - own.top, width, height, onTop: isTwitch }
  })
}
