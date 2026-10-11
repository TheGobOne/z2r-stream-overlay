export type Place = 1 | 2 | 3 | 4
export type Placements = (Place | null)[]

export const PLACE_LABELS: Record<Place, string> = { 1: "1ST", 2: "2ND", 3: "3RD", 4: "4TH" }

export function assignPlace(placements: Placements, player: number, place: Place | null): Placements {
  return placements.map((p, i) => {
    if (i === player) return place
    return place !== null && p === place ? null : p
  })
}

type WindowBox = { left: number; top: number; width: number; height: number }

/**
 * Centred on the bricks just below the player's video. It never overlaps the video itself,
 * because Twitch pauses embeds that anything covers.
 */
export function PlaceBadge({ place, win }: { place: Place | null | undefined; win: WindowBox }) {
  if (!place) return null
  return (
    <span
      className={`place-badge place-badge-${place}`}
      style={{ left: win.left + win.width / 2, top: win.top + win.height }}
      aria-label={`${PLACE_LABELS[place]} place`}
    >
      {PLACE_LABELS[place]}
    </span>
  )
}
