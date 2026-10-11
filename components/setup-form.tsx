"use client"

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
}

export function SetupForm({
  id,
  runnerCount,
  commentatorCount,
  maxRando,
  onRunnerCountChange,
  onCommentatorCountChange,
  onMaxRandoChange,
}: Props) {
  return (
    <>
      <div className="setup-section">
        <p id={`${id}-runners`} className="gem-modal-title">How many runners?</p>
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
        <p id={`${id}-coms`} className="gem-modal-title">How many commentators?</p>
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
    </>
  )
}
