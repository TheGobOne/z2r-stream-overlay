import { frameInWindow, hasSource, type VodConfig, type VodFrameLayout, type WindowRect } from "@/lib/vod"

// The 1456x816 stage is laid out on a 41x23 grid of bricks (each ~35.5px, near-square)
// so every border and divider is exactly one whole brick thick.
export const STAGE_WIDTH = 1456
export const STAGE_HEIGHT = 816
export const BRICK_COLS = 41
export const BRICK_ROWS = 23
export const BRICK_W = STAGE_WIDTH / BRICK_COLS
export const BRICK_H = STAGE_HEIGHT / BRICK_ROWS

export const QUAD_COUNT = 4
export const QUAD_TRACKER_WIDTH = 150

function brickRect(col: number, row: number, cols: number, rows: number): WindowRect {
  return { left: col * BRICK_W, top: row * BRICK_H, width: cols * BRICK_W, height: rows * BRICK_H }
}

// Player cells fill the left 31 brick columns as a 2x2 grid; the side panel takes the rest.
export const QUAD_CELLS: WindowRect[] = [
  brickRect(1, 1, 14, 10),
  brickRect(16, 1, 14, 10),
  brickRect(1, 12, 14, 10),
  brickRect(16, 12, 14, 10),
]

export const QUAD_PANEL = brickRect(31, 1, 9, 21)

// Each cell's tracker column sits to the right of its video, so a zoomed frame can spill
// sideways under the tracker and divider without ever reaching the next player's video.
export const QUAD_WINDOWS: WindowRect[] = QUAD_CELLS.map((cell) => ({
  left: cell.left,
  top: cell.top,
  width: cell.width - QUAD_TRACKER_WIDTH,
  height: cell.height,
}))

// Zoom at which a 16:9 video exactly fills a quad window's height
export const QUAD_DEFAULT_ZOOM =
  Math.round((QUAD_WINDOWS[0].height / ((QUAD_WINDOWS[0].width * 9) / 16)) * 100) / 100

// The settings panel is centered over the player grid, at the same size as the two-runner panel
export const QUAD_PANEL_DOCK: WindowRect = {
  left: (QUAD_CELLS[0].left + QUAD_CELLS[1].left + QUAD_CELLS[1].width - 655) / 2,
  top: (STAGE_HEIGHT - 511) / 2,
  width: 655,
  height: 511,
}

/**
 * Twitch pauses any embed whose iframe rect is covered, even where it's clipped away. A frame
 * may spill over bricks and trackers freely, but when it would reach another loaded player's
 * window it is pushed back toward its own outer edge, along whichever axis needs the least shift.
 */
export function resolveQuadLayouts(configs: VodConfig[]): VodFrameLayout[] {
  return configs.map((config, i) => {
    const own = QUAD_WINDOWS[i]
    const frame = frameInWindow(own, config)
    let left = own.left + frame.left
    let top = own.top + frame.top
    const { width, height } = frame

    if (hasSource(config)) {
      configs.forEach((other, j) => {
        if (j === i || !hasSource(other)) return
        const win = QUAD_WINDOWS[j]
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
