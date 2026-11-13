// Three triangles in a triangle, drawn on a 14x12 grid
const TRIFORCE = "M7 0 L10.5 6 L3.5 6 Z M3.5 6 L7 12 L0 12 Z M10.5 6 L14 12 L7 12 Z"

/** Series wins as small triforces at the left end of a name plate: filled for each win, outlined for those still needed. */
export function SeriesPips({ wins, toWin }: { wins: number; toWin: number }) {
  if (toWin < 1) return null
  return (
    <span className="series-pips" aria-label={`${wins} of ${toWin} wins`}>
      {Array.from({ length: toWin }, (_, i) => (
        <svg key={i} className={`series-pip${i < wins ? " won" : ""}`} viewBox="-1 -1 16 14" aria-hidden="true">
          <path d={TRIFORCE} />
        </svg>
      ))}
    </span>
  )
}
