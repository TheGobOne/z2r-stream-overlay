"use client"

type Props = {
  names: string[]
  wins: number[]
  bestOf: 1 | 3 | 5
  onBestOfChange: (value: 1 | 3 | 5) => void
  onChange: (runner: number, wins: number) => void
  /** Zero every score for a new series (Clear overlay keeps the score between games). */
  onReset: () => void
}

/** Games already won in a best-of series, shown as squares on each name plate. */
export function SeriesTools({ names, wins, bestOf, onBestOfChange, onChange, onReset }: Props) {
  const toWin = Math.ceil(bestOf / 2)
  return (
    <section className="tools-card" aria-labelledby="tools-series-title">
      <h2 id="tools-series-title" className="tools-card-title">
        Series score
      </h2>
      <div className="vod-panel-section">
        <div className="vod-row">
          <span className="vod-label">Best of</span>
          {([1, 3, 5] as const).map((n) => (
            <button
              key={n}
              type="button"
              className={`vod-btn${bestOf === n ? " vod-btn-primary" : ""}`}
              aria-pressed={bestOf === n}
              onClick={() => onBestOfChange(n)}
            >
              {n}
            </button>
          ))}
        </div>
        {names.map((name, i) => (
          <div key={i} className="vod-row">
            <span className="vod-label">{name || `Player ${i + 1}`}</span>
            <button type="button" className="vod-btn" disabled={wins[i] <= 0} onClick={() => onChange(i, wins[i] - 1)}>
              -
            </button>
            <span className="vod-value">
              {wins[i]} / {toWin}
            </span>
            <button type="button" className="vod-btn" disabled={wins[i] >= toWin} onClick={() => onChange(i, wins[i] + 1)}>
              +
            </button>
          </div>
        ))}
        <div className="vod-row">
          <button type="button" className="vod-btn" disabled={wins.every((w) => w === 0)} onClick={onReset}>
            New series (scores to 0)
          </button>
        </div>
        <p className="tools-hint">
          Clear overlay keeps the score between games. With a racetime room linked, the runner who finishes 1st gets a win automatically, once per room. Squares show on each name plate. Best of 1 hides them.
        </p>
      </div>
    </section>
  )
}
