"use client"

import { PLACE_LABELS, type Place, type Placements } from "@/components/place-badge"

export type RunnerCount = 2 | 3 | 4
export type CommentatorCount = 1 | 2

type Props = {
  id: string
  runnerCount: RunnerCount
  commentatorCount: CommentatorCount
  maxRando: boolean
  onRunnerCountChange: (value: RunnerCount) => void
  onCommentatorCountChange: (value: CommentatorCount) => void
  onMaxRandoChange: (value: boolean) => void
  /** Omit to hide the placement controls (e.g. in the opening popup). */
  placements?: Placements
  playerLabels?: string[]
  onPlacementChange?: (player: number, place: Place | null) => void
  /** Card heading rendered atop the left column so the Placements heading can sit level with it. */
  title?: { id: string; text: string }
}

export function SetupForm({
  id,
  runnerCount,
  commentatorCount,
  maxRando,
  onRunnerCountChange,
  onCommentatorCountChange,
  onMaxRandoChange,
  placements,
  playerLabels,
  onPlacementChange,
  title,
}: Props) {
  const players = Array.from({ length: runnerCount }, (_, i) => i)
  const places: Place[] = [...players.map((i) => (i + 1) as Place), "dnf"]
  return (
    <div className={placements && onPlacementChange ? "setup-columns" : undefined}>
      <div className="setup-column">
      {title && (
        <h2 id={title.id} className="tools-card-title">
          {title.text}
        </h2>
      )}
      <div className="setup-section">
        <p id={`${id}-runners`} className="gem-modal-title">Runners</p>
        <div className="gem-modal-options" role="radiogroup" aria-labelledby={`${id}-runners`}>
          {([2, 3, 4] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={runnerCount === n}
              className={`gem-modal-opt${runnerCount === n ? " selected" : ""}`}
              onClick={() => onRunnerCountChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="setup-section">
        <p id={`${id}-coms`} className="gem-modal-title">Commentators</p>
        <div className="gem-modal-options" role="radiogroup" aria-labelledby={`${id}-coms`}>
          {([1, 2] as const).map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={commentatorCount === n}
              className={`gem-modal-opt${commentatorCount === n ? " selected" : ""}`}
              onClick={() => onCommentatorCountChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <div className="setup-section">
        <label className="setup-checkbox">
          <input type="checkbox" checked={maxRando} onChange={(e) => onMaxRandoChange(e.target.checked)} />
          Max Rando
        </label>
      </div>
      </div>
      {placements && onPlacementChange && (
        <div className="setup-section setup-column">
          <h2 className="tools-card-title tools-card-title-sub">Placements</h2>
          <div className="setup-places">
            {players.map((player) => {
              const current = placements[player] ?? null
              const labelId = `${id}-place-${player}`
              return (
                <div key={player} className="setup-place-row">
                  <span id={labelId} className="setup-place-label">
                    {playerLabels?.[player] || `Player ${player + 1}`}
                  </span>
                  <div className="setup-place-options" role="radiogroup" aria-labelledby={labelId}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={current === null}
                      aria-label="No placement"
                      className={`setup-place-opt${current === null ? " selected" : ""}`}
                      onClick={() => onPlacementChange(player, null)}
                    >
                      -
                    </button>
                    {places.map((place) => (
                      <button
                        key={place}
                        type="button"
                        role="radio"
                        aria-checked={current === place}
                        className={`setup-place-opt setup-place-opt-${place}${current === place ? " selected" : ""}`}
                        onClick={() => onPlacementChange(player, place)}
                      >
                        {PLACE_LABELS[place]}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
