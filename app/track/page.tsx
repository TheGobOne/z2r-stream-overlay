"use client"

import { useEffect, useRef, useState } from "react"
import { BOSSES, ITEMS, type TrackerIcon } from "@/lib/tracker-catalog"
import { joinTracker, normalizeCode, type TrackerClient, type TrackerSnapshot } from "@/lib/tracker-link"

function IconGrid({
  icons,
  greyed,
  badges,
  onToggle,
  onRightClick,
  onMiddleClick,
  label,
}: {
  icons: TrackerIcon[]
  greyed: string[]
  badges: Record<string, string>
  onToggle: (id: string) => void
  onRightClick: (id: string) => void
  onMiddleClick: (id: string) => void
  label: string
}) {
  return (
    <div role="group" aria-label={label} style={{ display: "grid", gridTemplateColumns: "repeat(8, 40px)", gap: 4 }}>
      {icons.map((icon) => {
        const off = greyed.includes(icon.id)
        const badge = badges[icon.id]
        return (
          <button
            key={icon.id}
            type="button"
            title={`${icon.alt}. Click: toggle. Right-click: set location. Middle-click: clear.`}
            aria-label={`${icon.alt}: ${off ? "not yet" : "got it"}${badge ? `, location ${badge}` : ""}`}
            aria-pressed={!off}
            onClick={() => onToggle(icon.id)}
            onContextMenu={(e) => {
              e.preventDefault()
              onRightClick(icon.id)
            }}
            onAuxClick={(e) => {
              if (e.button === 1) {
                e.preventDefault()
                onMiddleClick(icon.id)
              }
            }}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              padding: 4,
              border: "1px solid var(--line)",
              background: "var(--cell)",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={icon.src}
              alt=""
              style={{
                width: "100%",
                height: "100%",
                imageRendering: "pixelated",
                opacity: off ? 0.3 : 1,
                filter: off ? "grayscale(1)" : "none",
              }}
            />
            {badge && (
              <span
                style={{
                  position: "absolute",
                  right: 0,
                  bottom: 0,
                  padding: "0 3px",
                  fontSize: 11,
                  fontWeight: 700,
                  background: "var(--accent)",
                  color: "#fff",
                  borderRadius: 3,
                }}
              >
                {badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function TrackPage() {
  const [draft, setDraft] = useState("")
  const [status, setStatus] = useState<"idle" | "joining" | "joined">("idle")
  const [error, setError] = useState("")
  const [snapshot, setSnapshot] = useState<TrackerSnapshot | null>(null)
  const clientRef = useRef<TrackerClient | null>(null)
  const [picker, setPicker] = useState<string | null>(null)

  async function join(raw: string) {
    const code = normalizeCode(raw)
    if (code.length < 4) {
      setError("Type the join code from the overlay's tools window")
      return
    }
    clientRef.current?.stop()
    setStatus("joining")
    setError("")
    try {
      clientRef.current = await joinTracker(code, setSnapshot, () => {
        setStatus("idle")
        setError("The overlay stopped sharing or closed. Join again when it's back.")
      })
      setStatus("joined")
      const url = new URL(window.location.href)
      url.searchParams.set("code", code)
      window.history.replaceState(null, "", url)
    } catch (e) {
      setStatus("idle")
      setError(e instanceof Error ? e.message : "Could not connect")
    }
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    if (code) {
      setDraft(code)
      void join(code)
    }
    return () => clientRef.current?.stop()
  }, [])

  return (
    <main className="track-page">
      <style>{`
        .track-page { --bg: #f4f4f2; --fg: #1d1d1b; --muted: #5f5f5a; --line: #c9c9c3; --cell: #ffffff; --accent: #b0381e;
          min-height: 100vh; background: var(--bg); color: var(--fg); font-family: system-ui, sans-serif; padding: 16px; }
        @media (prefers-color-scheme: dark) {
          .track-page { --bg: #151515; --fg: #ececea; --muted: #a4a49e; --line: #3a3a37; --cell: #222220; --accent: #e2643f; }
        }
        .track-page h1 { font-size: 20px; margin: 0 0 12px; }
        .track-page h2 { font-size: 16px; margin: 0 0 8px; }
        .track-page .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
        .track-page input { font: inherit; padding: 6px 8px; border: 1px solid var(--line); background: var(--cell); color: var(--fg); border-radius: 4px; text-transform: uppercase; width: 10ch; }
        .track-page button.action { font: inherit; padding: 6px 12px; border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 4px; cursor: pointer; }
        .track-page .muted { color: var(--muted); font-size: 14px; margin: 0 0 12px; }
        .track-page .error { color: var(--accent); font-size: 14px; margin: 0 0 12px; }
        .track-page .runners { display: flex; flex-wrap: wrap; gap: 24px; }
        .track-page .picker { margin-bottom: 16px; padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--cell); }
        .track-page section { display: flex; flex-direction: column; gap: 8px; }
      `}</style>
      <h1>Z2R remote tracker</h1>
      <div className="row">
        <label htmlFor="code">Join code</label>
        <input
          id="code"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && join(draft)}
          autoComplete="off"
          spellCheck={false}
        />
        <button type="button" className="action" disabled={status === "joining"} onClick={() => join(draft)}>
          {status === "joining" ? "Joining..." : status === "joined" ? "Rejoin" : "Join"}
        </button>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status === "joined" && <p className="muted">Connected. Click an icon to mark it; the overlay updates right away.</p>}
      {snapshot && picker && (
        <div className="picker" role="group" aria-label="Set location">
          <p className="muted">Location for {ITEMS.find((it) => it.id === picker)?.alt}</p>
          {snapshot.badgeOptions.map((row, r) => (
            <div key={r} className="row">
              {row.map((option) => (
                <button
                  key={option}
                  type="button"
                  className="action"
                  onClick={() => {
                    clientRef.current?.send({ type: "setItemBadge", id: picker, value: option })
                    setPicker(null)
                  }}
                >
                  {option}
                </button>
              ))}
            </div>
          ))}
          <div className="row">
            <button
              type="button"
              className="action"
              onClick={() => {
                clientRef.current?.send({ type: "setItemBadge", id: picker, value: null })
                setPicker(null)
              }}
            >
              Clear
            </button>
            <button type="button" className="action" onClick={() => setPicker(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {snapshot && (
        <div className="runners">
          {snapshot.runners.map((runner, i) => (
            <section key={i} aria-label={runner.name || `Player ${i + 1}`}>
              <h2>{runner.name || `Player ${i + 1}`}</h2>
              <IconGrid
                label="Bosses"
                icons={BOSSES}
                greyed={runner.bossesGreyed}
                badges={Object.fromEntries(Object.entries(snapshot.bossBadges).map(([id, n]) => [id, snapshot.bossBadgeLabels[n]]))}
                onToggle={(id) => clientRef.current?.send({ type: "toggleBoss", runner: i, id })}
                onRightClick={(id) => clientRef.current?.send({ type: "cycleBossBadge", id })}
                onMiddleClick={(id) => clientRef.current?.send({ type: "clearBossBadge", id })}
              />
              <IconGrid
                label="Items"
                icons={ITEMS}
                greyed={runner.itemsGreyed}
                badges={snapshot.itemBadges}
                onToggle={(id) => clientRef.current?.send({ type: "toggleItem", runner: i, id })}
                onRightClick={(id) => setPicker(id)}
                onMiddleClick={(id) => clientRef.current?.send({ type: "setItemBadge", id, value: null })}
              />
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
