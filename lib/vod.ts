export type VodSide = "left" | "right"

export type VodConfig = {
  url: string
  videoId: string | null
  /** Set instead of videoId when showing a live channel. */
  channel: string | null
  startSeconds: number
  loadKey: number
  zoom: number
  centerX: number
  centerY: number
  muted: boolean
  volume: number
}

// Transparent game-window holes in the 1456x816 overlay. The clip path cuts out
// each player's name box, which sits over the bottom corner of the window.
export const VOD_WINDOWS: Record<
  VodSide,
  { left: number; top: number; width: number; height: number; clipPath: string }
> = {
  // top sits 3px above the art's transparent hole so the video covers the grey shading row
  // along the bottom of the top brick band
  left: {
    left: 36,
    top: 33,
    width: 655,
    height: 511,
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 291px 100%, 291px 475px, 0 475px)",
  },
  right: {
    left: 764,
    top: 33,
    width: 655,
    height: 511,
    clipPath: "polygon(0 0, 100% 0, 100% 475px, 363px 475px, 363px 100%, 0 100%)",
  },
}


export const MIN_ZOOM = 1
export const MAX_ZOOM = 6
// Zoom at which a 16:9 VOD exactly fills the window height
export const DEFAULT_ZOOM = Math.round((511 / ((655 * 9) / 16)) * 100) / 100

export function createVodConfig(): VodConfig {
  return {
    url: "",
    videoId: null,
    channel: null,
    startSeconds: 0,
    loadKey: 0,
    zoom: DEFAULT_ZOOM,
    centerX: 0.5,
    centerY: 0.5,
    muted: false,
    volume: 0.5,
  }
}

/** A rectangle in video-relative coordinates, 0..1 on each axis. */
export type VideoRect = { x0: number; y0: number; x1: number; y1: number }

export const UNCROPPED_VIEW = { zoom: MIN_ZOOM, centerX: 0.5, centerY: 0.5 }

export type WindowRect = { left: number; top: number; width: number; height: number; clipPath?: string }

/**
 * Zoom and center so the whole selected area fits inside the window. When the selection's aspect
 * doesn't match the window's, extra video shows on the mismatched axis rather than any of the
 * selection being cut off.
 */
export function cropToSelection(win: WindowRect, sel: VideoRect) {
  const selWidth = Math.abs(sel.x1 - sel.x0)
  const selHeight = Math.abs(sel.y1 - sel.y0)
  const zoom = clamp(
    Math.min(1 / selWidth, win.height / (((win.width * 9) / 16) * selHeight)),
    MIN_ZOOM,
    MAX_ZOOM,
  )
  return { zoom, centerX: (sel.x0 + sel.x1) / 2, centerY: (sel.y0 + sel.y1) / 2 }
}

/** The part of the video, in video-relative coordinates, that shows through the window for a given view. */
export function visibleVideoRect(win: WindowRect, view: { zoom: number; centerX: number; centerY: number }): VideoRect {
  const halfWidth = 1 / view.zoom / 2
  const halfHeight = win.height / (((win.width * 9) / 16) * view.zoom) / 2
  return {
    x0: view.centerX - halfWidth,
    y0: view.centerY - halfHeight,
    x1: view.centerX + halfWidth,
    y1: view.centerY + halfHeight,
  }
}

export type VodFrameLayout = { left: number; top: number; width: number; height: number; onTop: boolean }

const WINDOW_GAP = VOD_WINDOWS.right.left - (VOD_WINDOWS.left.left + VOD_WINDOWS.left.width)

/** Where a 16:9 video frame sits, relative to its window, for a given zoom and center. */
export function frameInWindow(win: WindowRect, config: Pick<VodConfig, "zoom" | "centerX" | "centerY">) {
  const width = win.width * config.zoom
  const height = (width * 9) / 16
  return { left: win.width / 2 - config.centerX * width, top: win.height / 2 - config.centerY * height, width, height }
}

function frameFor(side: VodSide, config: VodConfig) {
  const win = VOD_WINDOWS[side]
  const { left, top, width, height } = frameInWindow(win, config)
  const innerOverflow = side === "left" ? left + width - win.width : -left
  return { left, top, width, height, innerOverflow }
}

/**
 * Twitch pauses any embed whose iframe rect is covered, and a zoomed iframe's full rect counts
 * even where it's clipped away. The frame reaching further toward the middle goes on top; the
 * other may only overflow into the gap between windows, never under the top window.
 */
export function resolveVodLayouts(configs: Record<VodSide, VodConfig>): Record<VodSide, VodFrameLayout> {
  const left = frameFor("left", configs.left)
  const right = frameFor("right", configs.right)
  const bothLoaded = hasSource(configs.left) && hasSource(configs.right)
  const leftOnTop = left.innerOverflow >= right.innerOverflow

  if (bothLoaded && leftOnTop) {
    right.left = Math.max(right.left, -WINDOW_GAP)
  } else if (bothLoaded) {
    left.left = Math.min(left.left, VOD_WINDOWS.left.width + WINDOW_GAP - left.width)
  }

  const toLayout = ({ left: l, top, width, height }: ReturnType<typeof frameFor>, onTop: boolean) => ({
    left: l,
    top,
    width,
    height,
    onTop,
  })
  return { left: toLayout(left, leftOnTop), right: toLayout(right, !leftOnTop) }
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

export function hasSource(config: VodConfig) {
  return Boolean(config.videoId || config.channel)
}

export type TwitchSource =
  | { kind: "vod"; videoId: string; startSeconds: number | null }
  | { kind: "live"; channel: string }

const CHANNEL_NAME = /^[a-zA-Z0-9_]{3,25}$/
const RESERVED_PATHS = new Set(["videos", "directory", "search", "settings", "downloads", "p", "jobs", "turbo"])

/**
 * Accepts a twitch.tv/videos/123 URL (optionally with ?t=1h2m3s), a bare video id,
 * a twitch.tv/channel URL, or a bare channel name for live streams.
 */
export function parseTwitchSource(input: string): TwitchSource | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const bare = trimmed.match(/^v?(\d{5,})$/)
  if (bare) return { kind: "vod", videoId: bare[1], startSeconds: null }
  if (CHANNEL_NAME.test(trimmed) && !RESERVED_PATHS.has(trimmed.toLowerCase())) {
    return { kind: "live", channel: trimmed.toLowerCase() }
  }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return null
    const fromPath = url.pathname.match(/\/videos\/(\d+)/)
    const fromQuery = url.searchParams.get("video")?.match(/^v?(\d+)$/)
    const videoId = fromPath?.[1] ?? fromQuery?.[1]
    if (videoId) {
      const t = url.searchParams.get("t")
      return { kind: "vod", videoId, startSeconds: t ? parseTime(t) : null }
    }

    const channel = url.searchParams.get("channel") ?? url.pathname.split("/").filter(Boolean)[0]
    if (channel && CHANNEL_NAME.test(channel) && !RESERVED_PATHS.has(channel.toLowerCase())) {
      return { kind: "live", channel: channel.toLowerCase() }
    }
    return null
  } catch {
    return null
  }
}

/** Parses "1:02:03", "62:03", "1h2m3s", or "3723" into seconds. */
export function parseTime(input: string): number | null {
  const value = input.trim().toLowerCase()
  if (!value) return null

  const units = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s)?$/)
  if (units && (units[1] || units[2] || units[3])) {
    return Number(units[1] ?? 0) * 3600 + Number(units[2] ?? 0) * 60 + Number(units[3] ?? 0)
  }

  const parts = value.split(":")
  if (parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  return parts.reduce((total, part) => total * 60 + Number(part), 0)
}

export function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
}

export function toTwitchTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m${s % 60}s`
}
