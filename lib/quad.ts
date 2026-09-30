import { frameInWindow, hasSource, type VodConfig, type VodFrameLayout, type WindowRect } from "@/lib/vod"

// The 1456x816 stage is laid out on a 41x23 grid of bricks (each ~35.5px, near-square)
// so every border and divider is exactly one whole brick thick.
export const STAGE_WIDTH = 1456
export const STAGE_HEIGHT = 816
export const BRICK_COLS = 41
export const BRICK_ROWS = 23
export const BRICK_W = STAGE_WIDTH / BRICK_COLS
export const BRICK_H = STAGE_HEIGHT / BRICK_ROWS

export const QUAD_TRACKER_WIDTH = 150

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
  dock: WindowRect
  defaultZoom: number
}

function buildLayout(cells: WindowRect[], panel: WindowRect, panelStyle: PanelStyle): GridLayout {
  // Each cell's tracker column sits to the right of its video, so a zoomed frame can spill
  // sideways under the tracker and divider without ever reaching the next player's video.
  const windows = cells.map((cell) => ({
    left: cell.left,
    top: cell.top,
    width: cell.width - QUAD_TRACKER_WIDTH,
    height: cell.height,
  }))
  return {
    count: cells.length,
    cells,
    windows,
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

// A 2x2 grid of players split by a full-height panel column in the middle, with one-brick borders throughout.
export const QUAD_LAYOUT = buildLayout(
  [brickRect(1, 1, 15, 10), brickRect(25, 1, 15, 10), brickRect(1, 12, 15, 10), brickRect(25, 12, 15, 10)],
  brickRect(17, 1, 7, 21),
  "column",
)

// Players 1 and 2 split the top half, player 3 takes the bottom-left quadrant and the panel the bottom-right.
export const TRIO_LAYOUT = buildLayout(
  [brickRect(1, 1, 18, 10), brickRect(22, 1, 18, 10), brickRect(1, 12, 18, 10)],
  brickRect(22, 12, 18, 10),
  "wide",
)

/**
 * Twitch pauses any embed whose iframe rect is covered, even where it's clipped away. A frame
 * may spill over bricks and trackers freely, but when it would reach another loaded player's
 * window it is pushed back toward its own outer edge, along whichever axis needs the least shift.
 */
export function resolveQuadLayouts(windows: WindowRect[], configs: VodConfig[]): VodFrameLayout[] {
  return configs.map((config, i) => {
    const own = windows[i]
    const frame = frameInWindow(own, config)
    let left = own.left + frame.left
    let top = own.top + frame.top
    const { width, height } = frame

    if (hasSource(config)) {
      configs.forEach((other, j) => {
        if (j === i || !hasSource(other)) return
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

    return { left: left - own.left, top: top - own.top, width, height, onTop: false }
  })
}
