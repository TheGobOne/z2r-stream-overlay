"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { ArcadeSky } from "@/components/arcade-decor"
import { useFitFontSize } from "@/lib/use-fit-font"

const STORAGE_KEY = "z2r-starting-soon"
const OVERLAY_KEY = "z2r-overlay-state"
const STAGE_W = 1456
const STAGE_H = 816

type Saved = { p1: string; p2: string; line: string; title: string }

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
  return {
    p1: params.get("p1") ?? saved.p1 ?? overlay.leftText ?? "",
    p2: params.get("p2") ?? saved.p2 ?? overlay.rightText ?? "",
    line: params.get("line") ?? saved.line ?? "",
    title: params.get("title") ?? saved.title ?? "STARTING SOON",
  }
}

export default function StartingSoonPage() {
  const [data, setData] = useState<Saved>({ p1: "", p2: "", line: "", title: "STARTING SOON" })
  const [loaded, setLoaded] = useState(false)
  const [scale, setScale] = useState(1)
  const p1Ref = useRef<HTMLInputElement>(null)
  const p2Ref = useRef<HTMLInputElement>(null)
  const nameOpts = { base: 60, min: 18, letterSpacing: 3 }
  const p1Size = useFitFontSize(p1Ref, data.p1, nameOpts)
  const p2Size = useFitFontSize(p2Ref, data.p2, nameOpts)

  useEffect(() => {
    setData(readSaved())
    setLoaded(true)
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

  const set = (key: keyof Saved) => (e: React.ChangeEvent<HTMLInputElement>) => setData((d) => ({ ...d, [key]: e.target.value }))

  return (
    <main className="ss-root">
      <style>{`
        @font-face {
          font-family: 'ZeldaII';
          src: url('/fonts/ZELDA-II-THE-ADVENTURE-OF-LINK.TTF') format('truetype');
        }
        html, body { margin: 0; background: #000; overflow: hidden; }
        .ss-root { width: 100vw; height: 100vh; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden; }
        .ss-stage {
          position: relative; width: ${STAGE_W}px; height: ${STAGE_H}px; flex: none;
          zoom: var(--ss-scale); background: #000; color: #fff;
          font-family: 'ZeldaII', monospace; text-transform: uppercase; overflow: hidden;
        }
        .ss-stage > * { position: absolute; }
        .arcade-sky { left: 0; top: 0; opacity: 0.75; }
        .arcade-stripes {
          left: 0; width: ${STAGE_W}px; height: 9px;
          background: linear-gradient(180deg, #FF4040 0 2px, #000 2px 3px, #FF9020 3px 5px, #000 5px 6px, #FFE040 6px 8px, #000 8px);
        }
        .ss-input {
          background: transparent; border: 0; outline: 0; color: inherit; font-family: inherit;
          text-transform: uppercase; text-align: center; width: 100%; padding: 0; caret-color: #FFE040;
        }
        .ss-input::placeholder { color: rgba(255, 255, 255, 0.18); }
        .ss-title { left: 0; width: ${STAGE_W}px; top: 130px; font-size: 84px; color: #FFE040; text-align: center; letter-spacing: 6px; }
        .ss-title .ss-input { font-size: 84px; letter-spacing: 6px; color: #FFE040; }
        .ss-tag { font-size: 28px; letter-spacing: 3px; }
        .ss-name { width: 520px; height: 90px; display: flex; align-items: center; }
        .ss-name .ss-input { line-height: 90px; letter-spacing: 3px; }
        .ss-vs { left: 0; width: ${STAGE_W}px; text-align: center; font-size: 56px; color: #FF50D0; top: 376px; line-height: 1; }
        .ss-line { left: 0; width: ${STAGE_W}px; top: 600px; font-size: 30px; letter-spacing: 3px; text-align: center; color: #fff; }
        .ss-line .ss-input { font-size: 30px; letter-spacing: 3px; }
        .ss-press { left: 0; width: ${STAGE_W}px; top: 700px; text-align: center; font-size: 26px; color: #30E0FF; letter-spacing: 4px; animation: ss-blink 1.2s steps(2, jump-none) infinite; }
        @keyframes ss-blink { 0% { opacity: 1; } 50% { opacity: 0; } 100% { opacity: 1; } }
        .ss-frame { background: var(--c); clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 6px 6px); }
        .ss-frame > i { position: absolute; inset: 4px; background: #000; clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px); }
        @media (prefers-reduced-motion: reduce) { .ss-press { animation: none; } }
      `}</style>
      <div className="ss-stage" style={{ ["--ss-scale" as string]: scale }}>
        <ArcadeSky />

        <div className="ss-title">
          <input className="ss-input" value={data.title} onChange={set("title")} spellCheck={false} aria-label="Title" />
        </div>

        <div className="ss-frame" style={{ left: 40, top: 290, width: 600, height: 220, ["--c" as string]: "#FF4040" }}>
          <i />
        </div>
        <div className="ss-frame" style={{ left: 816, top: 290, width: 600, height: 220, ["--c" as string]: "#30E0FF" }}>
          <i />
        </div>

        <div className="ss-tag" style={{ left: 70, top: 312, color: "#FF4040" }}>
          1P
        </div>
        <div className="ss-tag" style={{ left: 1316, top: 312, color: "#30E0FF", textAlign: "right", width: 70 }}>
          2P
        </div>
        <div className="ss-name" style={{ left: 80, top: 370 }}>
          <input
            ref={p1Ref}
            className="ss-input"
            style={{ fontSize: p1Size }}
            value={data.p1}
            onChange={set("p1")}
            placeholder="PLAYER 1"
            spellCheck={false}
            aria-label="Player 1 name"
          />
        </div>
        <div className="ss-name" style={{ left: 856, top: 370 }}>
          <input
            ref={p2Ref}
            className="ss-input"
            style={{ fontSize: p2Size }}
            value={data.p2}
            onChange={set("p2")}
            placeholder="PLAYER 2"
            spellCheck={false}
            aria-label="Player 2 name"
          />
        </div>

        <div className="ss-vs">VS</div>

        <div className="ss-line">
          <input className="ss-input" value={data.line} onChange={set("line")} placeholder="RACE INFO" spellCheck={false} aria-label="Race info" />
        </div>
        <div className="ss-press">PRESS START</div>
      </div>
    </main>
  )
}
