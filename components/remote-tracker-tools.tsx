"use client"

type Props = {
  code: string
  sharing: boolean
  busy: boolean
  error: string
  count: number
  onStart: () => void
  onStop: () => void
  onNewCode: () => void
}

export function RemoteTrackerTools({ code, sharing, busy, error, count, onStart, onStop, onNewCode }: Props) {
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/track?code=${code}`

  return (
    <section className="tools-card" aria-labelledby="tools-remote-title">
      <h2 id="tools-remote-title" className="tools-card-title">
        Remote trackers
      </h2>
      <div className="vod-panel-section">
        <p className="vod-label">
          Join code <span className="vod-time">{code || "..."}</span>
        </p>
        <div className="vod-row">
          {sharing ? (
            <button type="button" className="vod-btn" onClick={onStop}>
              Stop sharing
            </button>
          ) : (
            <button type="button" className="vod-btn vod-btn-primary" disabled={busy || !code} onClick={onStart}>
              {busy ? "Starting..." : "Start sharing"}
            </button>
          )}
          <button type="button" className="vod-btn" onClick={onNewCode}>
            New code
          </button>
          <button
            type="button"
            className="vod-btn"
            onClick={(e) => {
              const win = e.currentTarget.ownerDocument.defaultView ?? window
              void win.navigator.clipboard?.writeText(link).catch(() => {})
            }}
          >
            Copy link
          </button>
        </div>
        {error && (
          <p className="vod-error" role="alert">
            {error}
          </p>
        )}
        {sharing && (
          <p className="tools-hint">
            Sharing. {count} tracker{count === 1 ? "" : "s"} connected. Link: {link}
          </p>
        )}
        <p className="tools-hint">
          Trackers open the link (or z2rrestream.app/track and type the code) and can mark items and bosses for every runner. Keep this overlay open while they track.
        </p>
      </div>
    </section>
  )
}
