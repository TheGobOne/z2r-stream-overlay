"use client"

import { useEffect, useRef, useState } from "react"
import { ItemIcon } from "@/components/item-icon"
import { BOSSES, ITEMS, LINKABLE_ITEM, LINK_PREFIX, LINK_SPELLS, linkedSpellId, type TrackerIcon } from "@/lib/tracker-catalog"
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
    <div role="group" aria-label={label} className="icon-grid">
      {icons.map((icon) => {
        const off = greyed.includes(icon.id)
        const badge = badges[icon.id]
        const linked = linkedSpellId(badge)
        const linkedName = linked ? ITEMS.find((i) => i.id === linked)?.alt : undefined
        return (
          <button
            key={icon.id}
            type="button"
            className="cell"
            data-off={off || undefined}
            title={`${icon.alt}. Click: toggle. Right-click: set location. Middle-click: clear.`}
            aria-label={`${icon.alt}: ${off ? "not yet" : "got it"}${linkedName ? `, linked with ${linkedName}` : badge ? `, location ${badge}` : ""}`}
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
          >
            <ItemIcon item={icon} badge={badge} />
            {badge && !linked && <span className="badge">{badge}</span>}
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
  const [unstable, setUnstable] = useState(false)
  const clientRef = useRef<TrackerClient | null>(null)
  const [picker, setPicker] = useState<string | null>(null)
  const [bossPicker, setBossPicker] = useState<string | null>(null)

  // Each join gets a number; a join that finishes after a newer one started (or after unmount) is dropped
  const joinGenRef = useRef(0)
  const retryRef = useRef<number | undefined>(undefined)

  async function join(raw: string, attempt = 0) {
    const code = normalizeCode(raw)
    if (code.length < 4) {
      setError("Type the join code from the overlay's tools window")
      return
    }
    const gen = ++joinGenRef.current
    window.clearTimeout(retryRef.current)
    const old = clientRef.current
    clientRef.current = null
    old?.stop()
    setStatus("joining")
    setUnstable(false)
    if (attempt === 0) setError("")
    try {
      const client: TrackerClient = await joinTracker(code, setSnapshot, (full) => {
        if (clientRef.current !== client) return
        clientRef.current = null
        if (full) {
          setStatus("idle")
          setError("This overlay already has the most trackers it allows. Ask the host to free a spot, then join again.")
          return
        }
        retry(code, 0)
      }, setUnstable)
      if (gen !== joinGenRef.current) {
        client.stop()
        return
      }
      clientRef.current = client
      setStatus("joined")
      setError("")
      const url = new URL(window.location.href)
      url.searchParams.set("code", code)
      window.history.replaceState(null, "", url)
    } catch (e) {
      if (gen !== joinGenRef.current) return
      if (attempt > 0) return retry(code, attempt)
      setStatus("idle")
      setError(e instanceof Error ? e.message : "Could not connect")
    }
  }

  /** The overlay went away (reload, network): keep trying for about 5 minutes before giving up. */
  function retry(code: string, attempt: number) {
    const delays = [2000, 5000, 10000, 20000, 30000]
    if (attempt >= 12) {
      setStatus("idle")
      setError("The overlay stopped sharing or closed. Join again when it's back.")
      return
    }
    setStatus("joining")
    setError("Lost the overlay. Reconnecting...")
    retryRef.current = window.setTimeout(() => void join(code, attempt + 1), delays[Math.min(attempt, delays.length - 1)])
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code")
    // A tick later, so dev StrictMode's throwaway first mount cancels it instead of opening a second link
    const firstJoin = code ? window.setTimeout(() => {
      setDraft(code)
      void join(code)
    }, 0) : undefined
    return () => {
      window.clearTimeout(firstJoin)
      joinGenRef.current++
      window.clearTimeout(retryRef.current)
      // Null the ref before stopping: stop() fires the close handler, which would schedule a retry
      const client = clientRef.current
      clientRef.current = null
      client?.stop()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <main className="track-page">
      {/* Same look as the overlay's tools window: black, the Zelda II font, cyan notched frames, yellow headings */}
      <style>{`
        .track-page { --cyan: #30E0FF; --yellow: #FFE040; --red: #FF4040; --muted: #8A8AA8; --frame: var(--cyan);
          min-height: 100vh; background: #000; color: #fff; padding: 20px 16px 40px;
          font-family: 'ZeldaII', monospace; font-size: 12px; line-height: 1.6; }
        .track-page * { box-sizing: border-box; }
        .track-page h1 { margin: 0 0 18px; font-size: 20px; letter-spacing: 3px; color: var(--yellow); text-transform: uppercase; font-weight: normal; }
        .track-page h2 { margin: 0; font-size: 13px; letter-spacing: 2px; color: var(--yellow); text-transform: uppercase; font-weight: normal; }
        .track-page .card { position: relative; padding: 18px; background: #000; box-shadow: inset 0 0 0 4px var(--frame);
          clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 6px 6px); }
        .track-page .join { display: inline-flex; flex-direction: column; gap: 10px; margin-bottom: 18px; max-width: 100%; }
        .track-page .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
        .track-page label { color: var(--yellow); letter-spacing: 1px; text-transform: uppercase; }
        .track-page input { font: inherit; font-size: 14px; letter-spacing: 2px; padding: 7px 10px; width: 12ch; border: 2px solid var(--cyan); background: #000; color: var(--yellow); border-radius: 0; text-transform: uppercase; }
        .track-page input:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
        .track-page button.action { font: inherit; font-size: 10px; letter-spacing: 1px; text-transform: uppercase; padding: 8px 12px; border: 2px solid var(--cyan); background: #000; color: #fff; border-radius: 0; cursor: pointer; min-height: 34px; }
        .track-page button.action:hover:not(:disabled) { background: var(--cyan); color: #000; }
        .track-page button.action.primary { background: var(--yellow); border-color: var(--yellow); color: #000; }
        .track-page button.action.primary:hover:not(:disabled) { background: #fff; border-color: #fff; }
        .track-page button.action.icon { padding: 4px; min-width: 38px; }
        .track-page button.action.icon img { display: block; width: 24px; height: 24px; image-rendering: pixelated; }
        .track-page button:disabled { opacity: 0.4; cursor: not-allowed; }
        .track-page button:focus-visible { outline: 2px solid var(--red); outline-offset: 2px; }
        .track-page .muted { margin: 0 0 14px; color: var(--muted); }
        .track-page .error { margin: 0 0 14px; color: var(--red); }
        .track-page .runners { display: flex; flex-wrap: wrap; gap: 20px; align-items: flex-start; }
        .track-page .runner { display: flex; flex-direction: column; gap: 14px; }
        .track-page .picker { display: inline-flex; flex-direction: column; gap: 10px; margin-bottom: 18px; max-width: 100%; --frame: var(--yellow); }
        .track-page .picker .muted { margin: 0; }
        .track-page .icon-grid { display: grid; grid-template-columns: repeat(8, 40px); gap: 6px; }
        .track-page .cell { position: relative; width: 40px; height: 40px; padding: 0; border: 0; background: none; cursor: pointer; }
        .track-page .cell:hover { outline: 2px solid var(--cyan); outline-offset: 2px; }
        .track-page .cell:focus-visible { outline: 2px solid var(--yellow); outline-offset: 2px; }
        .track-page .cell img { display: block; width: 100%; height: 100%; image-rendering: pixelated; }
        .track-page .cell[data-off] img { opacity: 0.35; filter: grayscale(1); }
        .track-page .badge { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); pointer-events: none; z-index: 2;
          font-size: 13.5px; line-height: 1; color: #ffd700; text-shadow: -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000; }
      `}</style>
      <h1>Z2R remote tracker</h1>
      <div className="card join">
        <div className="row">
          <label htmlFor="code">Join code</label>
          <input
            id="code"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Same rule as the Join button: no second link while one is being made
              if (e.key === "Enter" && !(status === "joining" && !error)) void join(draft)
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button type="button" className="action primary" disabled={status === "joining" && !error} onClick={() => join(draft)}>
            {status === "joining" ? "Joining..." : status === "joined" ? "Rejoin" : "Join"}
          </button>
        </div>
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {status === "joined" && !unstable && <p className="muted">Connected. Click an icon to mark it; the overlay updates right away.</p>}
      {status === "joined" && unstable && (
        <p className="error" role="status">
          Connection unstable. Waiting for the overlay...
        </p>
      )}
      {snapshot && bossPicker && (
        <div className="card picker" role="group" aria-label="Set palace location">
          <p className="muted">Location for {BOSSES.find((b) => b.id === bossPicker)?.alt}</p>
          <div className="row">
            {snapshot.bossBadgeLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                className="action"
                onClick={() => {
                  clientRef.current?.send({ type: "setBossBadge", id: bossPicker, value: index })
                  setBossPicker(null)
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              className="action"
              onClick={() => {
                clientRef.current?.send({ type: "clearBossBadge", id: bossPicker })
                setBossPicker(null)
              }}
            >
              Clear
            </button>
            <button type="button" className="action" onClick={() => setBossPicker(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {snapshot && picker && (
        <div className="card picker" role="group" aria-label="Set location">
          <p className="muted">Location for {ITEMS.find((it) => it.id === picker)?.alt}</p>
          {picker === LINKABLE_ITEM && (
            <div className="row" role="group" aria-label="Link Fire to another spell">
              {LINK_SPELLS.map((id) => {
                const spell = ITEMS.find((i) => i.id === id)
                if (!spell) return null
                return (
                  <button
                    key={id}
                    type="button"
                    className="action icon"
                    title={`Link Fire with ${spell.alt}`}
                    aria-label={`Link Fire with ${spell.alt}`}
                    onClick={() => {
                      clientRef.current?.send({ type: "setItemBadge", id: picker, value: `${LINK_PREFIX}${id}` })
                      setPicker(null)
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={spell.src} alt="" />
                  </button>
                )
              })}
            </div>
          )}
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
        <div className="runners" aria-disabled={status !== "joined" || unstable} style={status !== "joined" || unstable ? { opacity: 0.4, pointerEvents: "none" } : undefined}>
          {snapshot.runners.map((runner, i) => (
            <section key={i} className="card runner" aria-label={runner.name || `Player ${i + 1}`}>
              <h2>{runner.name || `Player ${i + 1}`}</h2>
              <IconGrid
                label="Bosses"
                icons={BOSSES}
                greyed={runner.bossesGreyed}
                badges={Object.fromEntries(Object.entries(snapshot.bossBadges).map(([id, n]) => [id, snapshot.bossBadgeLabels[n]]))}
                onToggle={(id) => clientRef.current?.send({ type: "toggleBoss", runner: i, id, greyed: !runner.bossesGreyed.includes(id) })}
                onRightClick={(id) => {
                  setPicker(null)
                  setBossPicker(id)
                }}
                onMiddleClick={(id) => clientRef.current?.send({ type: "clearBossBadge", id })}
              />
              <IconGrid
                label="Items"
                icons={ITEMS}
                greyed={runner.itemsGreyed}
                badges={snapshot.itemBadges}
                onToggle={(id) => clientRef.current?.send({ type: "toggleItem", runner: i, id, greyed: !runner.itemsGreyed.includes(id) })}
                onRightClick={(id) => {
                  setBossPicker(null)
                  setPicker(id)
                }}
                onMiddleClick={(id) => clientRef.current?.send({ type: "setItemBadge", id, value: null })}
              />
            </section>
          ))}
        </div>
      )}
    </main>
  )
}
