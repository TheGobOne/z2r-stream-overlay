"use client"

import { useEffect, useState } from "react"
import { readStarting, writeStarting, type StartingData } from "@/lib/starting-screen"

type Props = {
  /** 3 or 4 runners use the four-name screen. */
  quad: boolean
  /** The names typed into the overlay, in slot order, for the copy button. */
  runnerNames: string[]
  /** The overlay's remote tracker join code; the OBS starting screen joins it to receive edits live. */
  shareCode: string
  /** True while the overlay is sharing (or starting to). */
  sharing: boolean
  onShare: () => void
  /** Reports the current text so the overlay can send it to the OBS starting screen. */
  onData: (data: StartingData) => void
}

export function StartingScreenTools({ quad, runnerNames, shareCode, sharing, onShare, onData }: Props) {
  const slots = quad ? (["p1", "p2", "p3", "p4"] as const) : (["p1", "p2"] as const)
  const [data, setData] = useState<StartingData>({ p1: "", p2: "", p3: "", p4: "", line: "", title: "STARTING SOON" })
  const [loaded, setLoaded] = useState(false)

  // Load this screen's saved text; a screen never saved before starts from the overlay's runner names
  useEffect(() => {
    const saved = readStarting(quad)
    if (saved) setData(saved)
    else {
      const fresh: StartingData = {
        p1: runnerNames[0] ?? "",
        p2: runnerNames[1] ?? "",
        p3: runnerNames[2] ?? "",
        p4: runnerNames[3] ?? "",
        line: "",
        title: "STARTING SOON",
      }
      setData(fresh)
      writeStarting(quad, fresh)
    }
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quad])

  // OBS's browser source keeps its own storage, so it joins the overlay's share code and gets every edit live.
  // The link never changes, so it is pasted into OBS once.
  const [copied, setCopied] = useState(false)
  const obsUrl = loaded && shareCode ? `${window.location.origin}${quad ? "/starting-soon-quad" : "/starting-soon"}?live&code=${shareCode}` : ""

  useEffect(() => {
    if (loaded) onData(data)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, loaded])

  function update(patch: Partial<StartingData>) {
    setData((prev) => {
      const next = { ...prev, ...patch }
      writeStarting(quad, next)
      return next
    })
  }

  return (
    <section className="tools-card" aria-labelledby="tools-starting-title">
      <h2 id="tools-starting-title" className="tools-card-title">
        Starting screen
      </h2>
      <div className="vod-panel-section">
        <label className="vod-label" htmlFor="tools-starting-heading">
          Title
        </label>
        <input
          id="tools-starting-heading"
          className="vod-input"
          type="text"
          value={data.title}
          disabled={!loaded}
          maxLength={40}
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => update({ title: e.target.value })}
        />
        {slots.map((slot) => (
          <div key={slot}>
            <label className="vod-label" htmlFor={`tools-starting-${slot}`}>
              Player {slot.slice(1)}
            </label>
            <input
              id={`tools-starting-${slot}`}
              className="vod-input"
              type="text"
              value={data[slot]}
              disabled={!loaded}
          maxLength={40}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => update({ [slot]: e.target.value })}
            />
          </div>
        ))}
        <label className="vod-label" htmlFor="tools-starting-line">
          Race info
        </label>
        <input
          id="tools-starting-line"
          className="vod-input"
          type="text"
          value={data.line}
          disabled={!loaded}
          maxLength={40}
          placeholder="Category, round, start time"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => update({ line: e.target.value })}
        />
        <div className="vod-row">
          <button
            type="button"
            className="vod-btn"
            onClick={() => update({ p1: runnerNames[0] ?? "", p2: runnerNames[1] ?? "", p3: runnerNames[2] ?? "", p4: runnerNames[3] ?? "" })}
          >
            Copy runner names
          </button>
          <button
            type="button"
            className="vod-btn"
            disabled={!obsUrl}
            onClick={(e) => {
              if (!sharing) onShare()
              const view = e.currentTarget.ownerDocument.defaultView
              void view?.navigator.clipboard?.writeText(obsUrl).then(() => setCopied(true), () => setCopied(false))
            }}
          >
            {copied ? "Copied" : "Copy OBS link"}
          </button>
        </div>
        <p className="tools-hint">Add as a browser source in your OBS</p>
        <p className="tools-hint">Edits show up there live while this overlay is open. Copying the link also turns on Remote trackers sharing, which carries them.</p>
      </div>
    </section>
  )
}
