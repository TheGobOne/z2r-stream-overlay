"use client"

import { useState } from "react"

type Props = {
  /** The linked room, or null when nothing is linked. */
  room: string | null
  /** One-line summary of the linked race, like "In progress, 2 runners". */
  summary: string
  error: string
  busy: boolean
  onImport: (input: string) => void
  onUnlink: () => void
  onSwap: () => void
}

export function RacetimeTools({ room, summary, error, busy, onImport, onUnlink, onSwap }: Props) {
  const [draft, setDraft] = useState("")

  return (
    <section className="tools-card" aria-labelledby="tools-racetime-title">
      <h2 id="tools-racetime-title" className="tools-card-title">
        Racetime.gg room
      </h2>
      <div className="vod-panel-section">
        <label className="vod-label" htmlFor="tools-racetime-url">
          Room link
        </label>
        <input
          id="tools-racetime-url"
          className="vod-input"
          type="text"
          value={draft}
          placeholder="https://racetime.gg/z2r/room-name-1234"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing || e.keyCode === 229) return
            onImport(draft)
          }}
        />
        <div className="vod-row">
          <button type="button" className="vod-btn vod-btn-primary" disabled={busy || !draft.trim()} onClick={() => onImport(draft)}>
            {room ? "Import again" : "Import room"}
          </button>
          {room && (
            <>
              <button type="button" className="vod-btn" onClick={onSwap}>
                Swap sides
              </button>
              <button type="button" className="vod-btn" onClick={onUnlink}>
                Unlink
              </button>
            </>
          )}
        </div>
        {error && (
          <p className="vod-error" role="alert">
            {error}
          </p>
        )}
        {room && !error && <p className="tools-hint">Linked to {room}. {summary}</p>}
        <p className="tools-hint">
          Fills the player names and live Twitch channels from the room and keeps the timer on the race clock. Runners without a linked Twitch account keep their current video.
        </p>
      </div>
    </section>
  )
}
