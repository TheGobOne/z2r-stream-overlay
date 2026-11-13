import type { WindowRect } from "@/lib/vod"

export const ARCADE_P1 = "#FF4040"
export const ARCADE_P2 = "#30E0FF"
export const ARCADE_YELLOW = "#FFE040"
export const ARCADE_MAGENTA = "#FF50D0"
/** Colour per player slot: 1P red, 2P cyan, 3P yellow, 4P magenta. */
export const ARCADE_COLORS = [ARCADE_P1, ARCADE_P2, ARCADE_YELLOW, ARCADE_MAGENTA]

// The tracker boxes under each game window, in stage pixels
export const ARCADE_TRACKERS = {
  left: { left: 10, top: 620, width: 420, height: 182 },
  right: { left: 1026, top: 620, width: 420, height: 182 },
}

const STAR_COLORS = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#FFE040", "#30E0FF", "#FF50D0"]

// Same stars on every load: a small seeded generator, not Math.random
function stars(count: number) {
  let seed = 47
  const next = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  return Array.from({ length: count }, () => {
    const size = next() < 0.3 ? 4 : 2
    return {
      x: Math.floor(next() * 1454),
      y: Math.floor(next() * 814),
      size,
      color: STAR_COLORS[Math.floor(next() * STAR_COLORS.length)],
    }
  })
}
const STARS = stars(120)

/** A stepped pixel frame in one player colour, drawn just outside `box`. */
export function ArcadeFrame({ box, color, pad = 6 }: { box: { left: number; top: number; width: number; height: number }; color: string; pad?: number }) {
  return (
    <div
      className="arcade-frame"
      style={{
        left: box.left - pad,
        top: box.top - pad,
        width: box.width + pad * 2,
        height: box.height + pad * 2,
        ["--c" as string]: color,
      }}
    >
      <div className="arcade-frame-in" />
    </div>
  )
}

/** Starfield and striped bars only, for layouts that draw their own frames. */
export function ArcadeSky() {
  return (
    <>
      <svg className="arcade-sky" viewBox="0 0 1456 816" width="1456" height="816" shapeRendering="crispEdges" aria-hidden="true">
        {STARS.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.size} height={s.size} fill={s.color} />
        ))}
      </svg>
      <div className="arcade-stripes" style={{ top: 0 }} aria-hidden="true" />
      <div className="arcade-stripes" style={{ top: 807, transform: "scaleY(-1)" }} aria-hidden="true" />
    </>
  )
}

/** Background, stripes and frames for the Arcade theme's 2-runner layout. Everything here sits behind the videos. */
export function ArcadeDecor({ windows }: { windows: Record<"left" | "right", WindowRect> }) {
  return (
    <div className="arcade-decor" aria-hidden="true">
      <svg className="arcade-sky" viewBox="0 0 1456 816" width="1456" height="816" shapeRendering="crispEdges">
        {STARS.map((s, i) => (
          <rect key={i} x={s.x} y={s.y} width={s.size} height={s.size} fill={s.color} />
        ))}
      </svg>
      <div className="arcade-stripes" style={{ top: 0 }} />
      <div className="arcade-stripes" style={{ top: 807, transform: "scaleY(-1)" }} />
      <ArcadeFrame box={windows.left} color={ARCADE_P1} />
      <ArcadeFrame box={windows.right} color={ARCADE_P2} />
      <ArcadeFrame box={ARCADE_TRACKERS.left} color={ARCADE_P1} pad={0} />
      <ArcadeFrame box={ARCADE_TRACKERS.right} color={ARCADE_P2} pad={0} />
    </div>
  )
}
