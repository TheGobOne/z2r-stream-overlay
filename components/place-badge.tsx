export type Place = 1 | 2 | 3 | 4 | "dnf"
export type Placements = (Place | null)[]

export const PLACE_LABELS: Record<Place, string> = { 1: "1ST", 2: "2ND", 3: "3RD", 4: "4TH", dnf: "DNF" }

/** Finishing places are unique per race; any number of runners can DNF. */
export function assignPlace(placements: Placements, player: number, place: Place | null): Placements {
  return placements.map((p, i) => {
    if (i === player) return place
    return place !== null && place !== "dnf" && p === place ? null : p
  })
}

type WindowBox = { left: number; top: number; width: number; height: number }

/**
 * Centred on the player's video window: just inside the bottom edge by default, inside the top edge for `"top"`,
 * or just above the window for `"above"` (clear of the video, so the video can never hide it).
 */
export function PlaceBadge({
  place,
  win,
  edge = "bottom",
}: {
  place: Place | null | undefined
  win: WindowBox
  edge?: "top" | "bottom" | "above"
}) {
  if (!place) return null
  return (
    <span
      className={`place-badge place-badge-${place}${edge === "top" ? " place-badge-top" : ""}${edge === "above" ? " place-badge-above" : ""}`}
      style={{ left: win.left + win.width / 2, top: edge === "bottom" ? win.top + win.height : win.top }}
      aria-label={`${PLACE_LABELS[place]} place`}
    >
      {PLACE_LABELS[place]}
    </span>
  )
}
