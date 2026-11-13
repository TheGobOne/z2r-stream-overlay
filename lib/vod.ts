export type VodSide = "left" | "right"

export type VodPlatform = "twitch" | "youtube"

export type VodConfig = {
  url: string
  platform: VodPlatform
  videoId: string | null
  /** Set instead of videoId when showing a live Twitch channel. */
  channel: string | null
  startSeconds: number
  loadKey: number
  zoom: number
  /** Vertical scale on top of zoom, so a crop stretches to fill the window exactly. */
  stretchY?: number
  centerX: number
  centerY: number
  /** The selected crop area; everything outside it is blacked out. */
  crop?: VideoRect | null
  muted: boolean
  volume: number
}

// Transparent game-window holes in the 1456x816 overlay. The name boxes sit in the
// brick row below the windows, so the video fills the whole window.
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
    clipPath: "none",
  },
  right: {
    left: 764,
    top: 33,
    width: 655,
    height: 511,
    clipPath: "none",
  },
}


export const MIN_ZOOM = 1
export const MAX_ZOOM = 6
// Zoom at which a 16:9 VOD exactly fills the window height
export const DEFAULT_ZOOM = Math.round((511 / ((655 * 9) / 16)) * 100) / 100

export function createVodConfig(): VodConfig {
  return {
    url: "",
    platform: "twitch",
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

export const UNCROPPED_VIEW = { zoom: MIN_ZOOM, stretchY: 1, centerX: 0.5, centerY: 0.5, crop: null }

export type WindowRect = { left: number; top: number; width: number; height: number; clipPath?: string }

type View = { zoom: number; stretchY?: number; centerX: number; centerY: number }

const MIN_STRETCH = 0.1
const MAX_STRETCH = 10

/**
 * With `fill`, zoom and stretch so the selected area exactly fills the window: the selection's
 * width sets the zoom and a vertical stretch makes its height match the window's. Without it,
 * the selection keeps its aspect ratio, fits inside the window centered, and the crop mask
 * blacks out the leftover bars.
 */
export function cropToSelection(win: WindowRect, sel: VideoRect, fill = true) {
  const crop = {
    x0: clamp(Math.min(sel.x0, sel.x1), 0, 1),
    y0: clamp(Math.min(sel.y0, sel.y1), 0, 1),
    x1: clamp(Math.max(sel.x0, sel.x1), 0, 1),
    y1: clamp(Math.max(sel.y0, sel.y1), 0, 1),
  }
  if (!fill) {
    const fitZoom = Math.min(
      1 / (crop.x1 - crop.x0),
      win.height / (((win.width * 9) / 16) * (crop.y1 - crop.y0)),
    )
    const zoom = clamp(fitZoom, MIN_ZOOM, MAX_ZOOM)
    return { zoom, stretchY: 1, centerX: (crop.x0 + crop.x1) / 2, centerY: (crop.y0 + crop.y1) / 2, crop }
  }
  const zoom = clamp(1 / (crop.x1 - crop.x0), MIN_ZOOM, MAX_ZOOM)
  const stretchY = clamp(
    win.height / (((win.width * zoom * 9) / 16) * (crop.y1 - crop.y0)),
    MIN_STRETCH,
    MAX_STRETCH,
  )
  return { zoom, stretchY, centerX: (crop.x0 + crop.x1) / 2, centerY: (crop.y0 + crop.y1) / 2, crop }
}

/** The part of the video, in video-relative coordinates, that shows through the window for a given view. */
export function visibleVideoRect(win: WindowRect, view: View): VideoRect {
  const halfWidth = 1 / view.zoom / 2
  const halfHeight = win.height / (((win.width * 9) / 16) * view.zoom * (view.stretchY ?? 1)) / 2
  return {
    x0: view.centerX - halfWidth,
    y0: view.centerY - halfHeight,
    x1: view.centerX + halfWidth,
    y1: view.centerY + halfHeight,
  }
}

export type VodFrameLayout = {
  left: number
  top: number
  width: number
  height: number
  onTop: boolean
  /** Explicit stacking order, overriding `onTop`, when several frames must stack in a set order. */
  z?: number
}

/** Game windows of the Arcade theme's 2-runner layout: two 704x528 (4:3) screens under a top HUD. */
export const ARCADE_WINDOWS: Record<VodSide, WindowRect> = {
  left: { left: 16, top: 80, width: 704, height: 528 },
  right: { left: 736, top: 80, width: 704, height: 528 },
}

/**
 * A saved crop is re-derived from its selection so crops made under older rules (such as the
 * letterboxed fit) always render with the current fill behavior for this window.
 */
export function resolveView(win: WindowRect, config: View & { crop?: VideoRect | null }, fill = true): View {
  return config.crop ? cropToSelection(win, config.crop, fill) : config
}

/** Where the (possibly vertically stretched) video frame sits, relative to its window. */
export function frameInWindow(win: WindowRect, config: View & { crop?: VideoRect | null }, fill = true) {
  config = resolveView(win, config, fill)
  const width = win.width * config.zoom
  const height = ((width * 9) / 16) * (config.stretchY ?? 1)
  return { left: win.width / 2 - config.centerX * width, top: win.height / 2 - config.centerY * height, width, height }
}

// While picking a crop, the player temporarily grows to the largest 16:9 area of the 1456x816 stage
const FOCUS_WIDTH = (816 * 16) / 9
export const CROP_FOCUS_WINDOW: WindowRect = { left: (1456 - FOCUS_WIDTH) / 2, top: 0, width: FOCUS_WIDTH, height: 816 }
export const CROP_FOCUS_LAYOUT: VodFrameLayout = { ...frameInWindow(CROP_FOCUS_WINDOW, UNCROPPED_VIEW), onTop: true }

function frameFor(side: VodSide, config: VodConfig, windows: Record<VodSide, WindowRect>) {
  const win = windows[side]
  const { left, top, width, height } = frameInWindow(win, config)
  const innerOverflow = side === "left" ? left + width - win.width : -left
  return { left, top, width, height, innerOverflow }
}

/**
 * Twitch pauses any embed whose iframe rect is covered, and a zoomed iframe's full rect counts
 * even where it's clipped away. The frame reaching further toward the middle goes on top; the
 * other may only overflow into the gap between windows, never under the top window.
 */
export function resolveVodLayouts(
  configs: Record<VodSide, VodConfig>,
  windows: Record<VodSide, WindowRect> = VOD_WINDOWS,
): Record<VodSide, VodFrameLayout> {
  const left = frameFor("left", configs.left, windows)
  const right = frameFor("right", configs.right, windows)
  const gap = windows.right.left - (windows.left.left + windows.left.width)
  const bothLoaded = hasSource(configs.left) && hasSource(configs.right)
  const leftOnTop = left.innerOverflow >= right.innerOverflow

  if (bothLoaded && leftOnTop) {
    right.left = Math.max(right.left, -gap)
  } else if (bothLoaded) {
    left.left = Math.min(left.left, windows.left.width + gap - left.width)
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

    const liveChannel = url.searchParams.get("channel") ?? url.pathname.split("/").filter(Boolean)[0]
    if (liveChannel && CHANNEL_NAME.test(liveChannel) && !RESERVED_PATHS.has(liveChannel.toLowerCase())) {
      return { kind: "live", channel: liveChannel.toLowerCase() }
    }
    return null
  } catch {
    return null
  }
}

export type YouTubeSource = { kind: "vod"; videoId: string; startSeconds: number | null }

const YOUTUBE_VIDEO_ID = /^[a-zA-Z0-9_-]{10,12}$/

/**
 * Accepts a youtube.com/watch?v=..., youtu.be/..., youtube.com/live/..., youtube.com/embed/...,
 * or youtube.com/shorts/... URL (optionally with ?t=1h2m3s or ?t=123).
 */
export function parseYouTubeSource(input: string): YouTubeSource | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    const host = url.hostname.replace(/^www\./, "").replace(/^m\./, "")
    let videoId: string | null = null
    if (host === "youtu.be") {
      videoId = url.pathname.split("/").filter(Boolean)[0] ?? null
    } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      videoId = url.searchParams.get("v") ?? url.pathname.match(/\/(?:embed|live|shorts)\/([^/?]+)/)?.[1] ?? null
    } else {
      return null
    }
    if (!videoId || !YOUTUBE_VIDEO_ID.test(videoId)) return null

    const t = url.searchParams.get("t") ?? url.searchParams.get("start")
    return { kind: "vod", videoId, startSeconds: t ? parseTime(t) : null }
  } catch {
    return null
  }
}

export type VodSource =
  | { platform: "twitch"; kind: "vod"; videoId: string; startSeconds: number | null }
  | { platform: "twitch"; kind: "live"; channel: string }
  | { platform: "youtube"; kind: "vod"; videoId: string; startSeconds: number | null }

/** Tries Twitch first (VOD, channel, or bare id), then YouTube (VOD links only). */
export function parseVodSource(input: string): VodSource | null {
  const twitch = parseTwitchSource(input)
  if (twitch) return { platform: "twitch", ...twitch }
  const youtube = parseYouTubeSource(input)
  if (youtube) return { platform: "youtube", ...youtube }
  return null
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
