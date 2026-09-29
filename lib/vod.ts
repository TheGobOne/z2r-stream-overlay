export type VodSide = "left" | "right"

export type VodConfig = {
  url: string
  videoId: string | null
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
  left: {
    left: 36,
    top: 36,
    width: 655,
    height: 508,
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 292px 100%, 292px 472px, 0 472px)",
  },
  right: {
    left: 764,
    top: 36,
    width: 655,
    height: 508,
    clipPath: "polygon(0 0, 100% 0, 100% 472px, 363px 472px, 363px 100%, 0 100%)",
  },
}

// Width of the right-clickable brick strip around each window when a VOD is loaded
export const FRAME_HITBOX = 30

export const MIN_ZOOM = 1
export const MAX_ZOOM = 6
// Zoom at which a 16:9 VOD exactly fills the window height
export const DEFAULT_ZOOM = Math.round((508 / ((655 * 9) / 16)) * 100) / 100

export function createVodConfig(): VodConfig {
  return {
    url: "",
    videoId: null,
    startSeconds: 0,
    loadKey: 0,
    zoom: DEFAULT_ZOOM,
    centerX: 0.5,
    centerY: 0.5,
    muted: false,
    volume: 0.5,
  }
}

export type VodFrameLayout = { left: number; top: number; width: number; height: number; onTop: boolean }

const WINDOW_GAP = VOD_WINDOWS.right.left - (VOD_WINDOWS.left.left + VOD_WINDOWS.left.width)

function frameFor(side: VodSide, config: VodConfig) {
  const win = VOD_WINDOWS[side]
  const width = win.width * config.zoom
  const height = (width * 9) / 16
  const left = win.width / 2 - config.centerX * width
  const top = win.height / 2 - config.centerY * height
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
  const bothLoaded = Boolean(configs.left.videoId && configs.right.videoId)
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

/** Accepts a twitch.tv/videos/123 URL (optionally with ?t=1h2m3s) or a bare video id. */
export function parseTwitchVod(input: string): { videoId: string; startSeconds: number | null } | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const bare = trimmed.match(/^v?(\d{5,})$/)
  if (bare) return { videoId: bare[1], startSeconds: null }

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
    if (!/(^|\.)twitch\.tv$/.test(url.hostname)) return null
    const fromPath = url.pathname.match(/\/videos\/(\d+)/)
    const fromQuery = url.searchParams.get("video")?.match(/^v?(\d+)$/)
    const videoId = fromPath?.[1] ?? fromQuery?.[1]
    if (!videoId) return null
    const t = url.searchParams.get("t")
    return { videoId, startSeconds: t ? parseTime(t) : null }
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
