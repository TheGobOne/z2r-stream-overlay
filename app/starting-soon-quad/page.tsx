"use client"

import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArcadeSky } from "@/components/arcade-decor"
import { useFitFontSize } from "@/lib/use-fit-font"
import { useStartingLink } from "@/lib/use-starting-link"
import { preload } from "react-dom"
import { ZELDA_FONT } from "@/lib/fonts"

const STORAGE_KEY = "z2r-starting-soon-quad"
const OVERLAY_KEY = "z2r-overlay-state"
const STAGE_W = 1456
const STAGE_H = 816

type Saved = { p1: string; p2: string; p3: string; p4: string; line: string; title: string }
type Slot = "p1" | "p2" | "p3" | "p4"

const SLOTS: { key: Slot; tag: string; color: string; x: number; y: number }[] = [
  { key: "p1", tag: "1P", color: "#FF4040", x: 148, y: 148 },
  { key: "p2", tag: "2P", color: "#30E0FF", x: 748, y: 148 },
  { key: "p3", tag: "3P", color: "#FFE040", x: 148, y: 448 },
  { key: "p4", tag: "4P", color: "#FF50D0", x: 748, y: 448 },
]
const FRAME_W = 560
const FRAME_H = 260

function readSaved(): Saved {
  const params = new URLSearchParams(window.location.search)
  let saved: Partial<Saved> = {}
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}")
  } catch {}
  // First visit: borrow the runner names already typed into the overlay
  let overlay: { leftText?: string; rightText?: string } = {}
  try {
    overlay = JSON.parse(localStorage.getItem(OVERLAY_KEY) ?? "{}")
  } catch {}
  const pick = (key: Slot, fallback: string) => params.get(key) ?? saved[key] ?? fallback
  return {
    p1: pick("p1", overlay.leftText ?? ""),
    p2: pick("p2", overlay.rightText ?? ""),
    p3: pick("p3", ""),
    p4: pick("p4", ""),
    line: params.get("line") ?? saved.line ?? "",
    title: params.get("title") ?? saved.title ?? "STARTING SOON",
  }
}

/** VS on the seam between each pair, on by default. ?pairs=0 hides it. */
function readPairs(): boolean {
  const param = new URLSearchParams(window.location.search).get("pairs")
  return param !== "0"
}

function NameInput({ slot, value, onChange, color }: { slot: Slot; value: string; onChange: (v: string) => void; color: string }) {
  const ref = useRef<HTMLInputElement>(null)
  const size = useFitFontSize(ref, value, { base: 48, min: 16, letterSpacing: 3 })
  return (
    <input
      ref={ref}
      className="ss-input"
      style={{ fontSize: size, color }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`PLAYER ${slot.slice(1)}`}
      spellCheck={false}
      aria-label={`Player ${slot.slice(1)} name`}
    />
  )
}

export default function StartingSoonQuadPage() {
  preload(ZELDA_FONT, { as: "font", type: "font/ttf", crossOrigin: "anonymous" })
  const [data, setData] = useState<Saved>({ p1: "", p2: "", p3: "", p4: "", line: "", title: "STARTING SOON" })
  const [pairs, setPairs] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [scale, setScale] = useState(1)

  const [live, setLive] = useState(false)
  // ?code= joins the overlay's share code so edits made in the Booth arrive live, even in OBS's own browser
  const [code, setCode] = useState<string | null>(null)
  useStartingLink(code, setData)

  useEffect(() => {
    setData(readSaved())
    setPairs(readPairs())
    setLive(new URLSearchParams(window.location.search).has("live"))
    setCode(new URLSearchParams(window.location.search).get("code"))
    setLoaded(true)
  }, [])

  // The Booth edits this screen from another window; pick its changes up as they are saved
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setData(readSaved())
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [])

  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {}
  }, [data, loaded])

  // Fit the fixed 1456x816 stage to the window, like the overlay does
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  const set = (key: keyof Saved) => (value: string) => setData((d) => ({ ...d, [key]: value }))

  return (
    <main className="ss-root" data-live={live || undefined}>
      <style>{`
        .ss-root[data-live] .ss-input { pointer-events: none; caret-color: transparent; }
        .ss-root[data-live] .ss-input::placeholder { color: transparent; }
        html, body { margin: 0; background: #000; overflow: hidden; }
        .ss-root { width: 100vw; height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .ss-stage {
          position: relative; width: ${STAGE_W}px; height: ${STAGE_H}px; flex: none;
          zoom: var(--ss-scale); background: #000; color: #fff;
          font-family: 'ZeldaII', monospace; text-transform: uppercase; overflow: hidden;
        }
        .ss-stage > * { position: absolute; }
        .arcade-sky { left: 0; top: 0; opacity: 0.75; }
        .ss-input {
          background: transparent; border: 0; outline: 0; color: inherit; font-family: inherit;
          text-transform: uppercase; text-align: center; width: 100%; padding: 0; caret-color: #FFE040;
        }
        .ss-input::placeholder { color: rgba(255, 255, 255, 0.18); }
        .ss-title { left: 0; width: ${STAGE_W}px; top: 22px; font-size: 64px; color: #FFE040; text-align: center; letter-spacing: 6px; }
        .ss-title .ss-input { font-size: 64px; letter-spacing: 6px; color: #FFE040; }
        .ss-tag { font-size: 24px; letter-spacing: 3px; width: 60px; }
        .ss-name { width: 440px; height: 80px; display: flex; align-items: center; }
        .ss-name .ss-input { line-height: 80px; letter-spacing: 3px; }
        .ss-vs-badge {
          transform: translate(-50%, -50%); z-index: 2; padding: 4px 10px 6px;
          font-size: 22px; line-height: 1; color: #FFE040; background: #000; box-shadow: 0 0 0 2px #FFE040;
        }
        .ss-line { left: 0; width: ${STAGE_W}px; top: 748px; font-size: 24px; letter-spacing: 3px; text-align: center; color: #FFE040; }
        .ss-line .ss-input { font-size: 24px; letter-spacing: 3px; }
        .ss-frame { background: var(--c); clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 6px 6px); }
        .ss-frame > i { position: absolute; inset: 4px; background: #000; clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px); }
      `}</style>
      <div className="ss-stage" style={{ ["--ss-scale" as string]: scale }}>
        <ArcadeSky />

        <div className="ss-title">
          <input className="ss-input" value={data.title} onChange={(e) => set("title")(e.target.value)} spellCheck={false} aria-label="Title" />
        </div>

        {SLOTS.map((slot) => (
          <Fragment key={slot.key}>
            <div className="ss-frame" style={{ left: slot.x, top: slot.y, width: FRAME_W, height: FRAME_H, ["--c" as string]: slot.color }}>
              <i />
            </div>
            <div className="ss-tag" style={{ left: slot.x + 22, top: slot.y + 22, color: slot.color }}>
              {slot.tag}
            </div>
            <div className="ss-name" style={{ left: slot.x + 80, top: slot.y + 90 }}>
              <NameInput slot={slot.key} value={data[slot.key]} onChange={set(slot.key)} color="#fff" />
            </div>
          </Fragment>
        ))}

        {pairs && (
          <>
            <div className="ss-vs-badge" style={{ position: "absolute", left: STAGE_W / 2, top: SLOTS[0].y + FRAME_H / 2 }}>VS</div>
            <div className="ss-vs-badge" style={{ position: "absolute", left: STAGE_W / 2, top: SLOTS[2].y + FRAME_H / 2 }}>VS</div>
          </>
        )}

        <div className="ss-line">
          <input className="ss-input" value={data.line} onChange={(e) => set("line")(e.target.value)} placeholder="RACE INFO" spellCheck={false} aria-label="Race info" />
        </div>
      </div>
    </main>
  )
}
