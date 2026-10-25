import type { CSSProperties, ReactNode } from "react"
import { BOSSES, ITEMS } from "@/lib/tracker-icons"

export const STAGE_W = 1456
export const STAGE_H = 816
export const BW = STAGE_W / 41
export const BH = STAGE_H / 23

/** Brick-grid helpers: convert brick columns/rows to stage pixels. */
export const bx = (n: number) => n * BW
export const by = (n: number) => n * BH

export type Place = 1 | 2 | 3 | 4 | "dnf"

const PLACE_STYLE: Record<string, { label: string; bg: string; fg: string }> = {
  "1": { label: "1ST", bg: "#ffd700", fg: "#000" },
  "2": { label: "2ND", bg: "#d8d8d8", fg: "#000" },
  "3": { label: "3RD", bg: "#c8742c", fg: "#000" },
  "4": { label: "4TH", bg: "#3050f8", fg: "#fff" },
  dnf: { label: "DNF", bg: "#d82800", fg: "#fff" },
}

type Box = { x: number; y: number; w: number; h: number }

export function Abs({
  x,
  y,
  w,
  h,
  className,
  style,
  children,
}: Box & { className?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <div className={`mk-abs ${className ?? ""}`} style={{ left: x, top: y, width: w, height: h, ...style }}>
      {children}
    </div>
  )
}

export function Bricks() {
  return <div className="mk-bricks" aria-hidden="true" />
}

export function Video({
  x,
  y,
  w,
  h,
  n,
  place,
  accent,
}: Box & { n: number; place?: Place; accent?: string }) {
  const chip = place ? PLACE_STYLE[String(place)] : null
  return (
    <Abs
      x={x}
      y={y}
      w={w}
      h={h}
      className="mk-video"
      style={accent ? { boxShadow: `0 0 0 4px ${accent}` } : undefined}
    >
      <span className="mk-video-label">
        PLAYER {n}
        <small>
          {Math.round(w)} x {Math.round(h)}
        </small>
      </span>
      {chip && (
        <span className="mk-place" style={{ background: chip.bg, color: chip.fg }}>
          {chip.label}
        </span>
      )}
    </Abs>
  )
}

export function Panel({ x, y, w, h, children, style }: Box & { children?: ReactNode; style?: CSSProperties }) {
  return (
    <Abs x={x} y={y} w={w} h={h} className="mk-panel" style={style}>
      {children}
    </Abs>
  )
}

export function NamePlate({
  n,
  accent = "#3050f8",
  width,
  height = 34,
  fontSize = 12,
  short = false,
}: {
  n: number
  accent?: string
  width?: number | string
  height?: number
  fontSize?: number
  short?: boolean
}) {
  return (
    <div className="mk-name" style={{ width, height, fontSize, ["--accent" as string]: accent } as CSSProperties}>
      <span style={{ lineHeight: `${height - 6}px` }}>{short ? `P${n}` : `PLAYER ${n}`}</span>
    </div>
  )
}

function IconGrid({
  icons,
  cols,
  size,
  gap,
  seed,
  density,
}: {
  icons: { id: string; src: string; alt: string }[]
  cols: number
  size: number
  gap: number
  seed: number
  density: number
}) {
  return (
    <div
      className="mk-icons"
      style={{ gridTemplateColumns: `repeat(${cols}, ${size}px)`, gap, width: cols * size + (cols - 1) * gap }}
    >
      {icons.map((icon, i) => {
        const lit = (i * 7 + seed * 3) % 10 < density
        return (
          <img
            key={icon.id}
            src={icon.src || "/placeholder.svg"}
            alt=""
            width={size}
            height={size}
            className={lit ? "mk-lit" : "mk-dim"}
          />
        )
      })}
    </div>
  )
}

/** Boss row(s) followed by the item grid. `cols` is the item grid width; bosses use `bossCols` (default: all in one row). */
export function Tracker({
  cols,
  size = 28,
  gap = 2,
  bossCols = 6,
  seed = 0,
  align = "center",
  direction = "column",
}: {
  cols: number
  size?: number
  gap?: number
  bossCols?: number
  seed?: number
  align?: "center" | "flex-start"
  direction?: "column" | "row"
}) {
  const bosses = BOSSES.filter((b) => b.id !== "thunderbird")
  return (
    <div className="mk-tracker" style={{ alignItems: align, gap: Math.max(6, gap * 3), flexDirection: direction }}>
      <IconGrid icons={bosses} cols={bossCols} size={size} gap={gap} seed={seed} density={5} />
      <IconGrid icons={ITEMS} cols={cols} size={size} gap={gap} seed={seed} density={3} />
    </div>
  )
}

export function Gold({ children, size = 13 }: { children: ReactNode; size?: number }) {
  return (
    <span className="mk-gold" style={{ fontSize: size }}>
      {children}
    </span>
  )
}

export function Field({ children, height = 26, grow }: { children?: ReactNode; height?: number; grow?: boolean }) {
  return (
    <div className="mk-field" style={{ height, flex: grow ? 1 : undefined }}>
      {children}
    </div>
  )
}

export function Timer({ size = 26 }: { size?: number }) {
  return (
    <span className="mk-timer" style={{ fontSize: size }}>
      0:00:00
    </span>
  )
}

/** One-brick-tall strip: race info, commentary, tracking and the timer on a single row. */
export function Bar({ x, y, w, h }: Box) {
  return (
    <Panel x={x} y={y} w={w} h={h} style={{ flexDirection: "row", alignItems: "center", gap: 20, padding: "0 16px" }}>
      <div style={{ flex: 1.3, minWidth: 0 }}>
        <Field height={24}>
          <span className="mk-ph">RACE INFO</span>
        </Field>
      </div>
      <Gold>COMMENTARY</Gold>
      <span className="mk-ph">COM 1</span>
      <span className="mk-ph">COM 2</span>
      <Gold>TRACKING</Gold>
      <span className="mk-ph">TRACKING</span>
      <Timer size={14} />
    </Panel>
  )
}

/** Vertical stack of the broadcast fields, used in side rails and center consoles. */
export function InfoStack({ timerSize = 30, gap = 10 }: { timerSize?: number; gap?: number }) {
  return (
    <div className="mk-info" style={{ gap }}>
      <Gold>RACE INFO</Gold>
      <Field height={56}>
        <span className="mk-ph">RACE INFO</span>
      </Field>
      <Gold>COMMENTARY</Gold>
      <Field>
        <span className="mk-ph">COM 1</span>
      </Field>
      <Field>
        <span className="mk-ph">COM 2</span>
      </Field>
      <Gold>TRACKING</Gold>
      <Field>
        <span className="mk-ph">TRACKING</span>
      </Field>
      <Field>
        <span className="mk-ph">TRACKING</span>
      </Field>
      <div style={{ marginTop: "auto", paddingTop: 6 }}>
        <Timer size={timerSize} />
      </div>
    </div>
  )
}

/** Broadcast fields laid out on a grid. `compact` fits a 2-brick-tall slot; otherwise three headed columns. */
export function InfoBlock({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gridTemplateRows: "repeat(2, 1fr)",
          alignItems: "center",
          gap: 8,
          width: "100%",
          height: "100%",
        }}
      >
        <Field height={28}>
          <span className="mk-ph">RACE INFO</span>
        </Field>
        <Field height={28}>
          <span className="mk-ph">COM 1</span>
        </Field>
        <Field height={28}>
          <span className="mk-ph">COM 2</span>
        </Field>
        <Field height={28}>
          <span className="mk-ph">TRACKING</span>
        </Field>
        <Field height={28}>
          <span className="mk-ph">TRACKING</span>
        </Field>
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Timer size={22} />
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, width: "100%", height: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Gold>RACE INFO</Gold>
        <Field height={40}>
          <span className="mk-ph">RACE INFO</span>
        </Field>
        <div style={{ marginTop: "auto" }}>
          <Timer size={30} />
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Gold>COMMENTARY</Gold>
        <Field>
          <span className="mk-ph">COM 1</span>
        </Field>
        <Field>
          <span className="mk-ph">COM 2</span>
        </Field>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <Gold>TRACKING</Gold>
        <Field>
          <span className="mk-ph">TRACKING</span>
        </Field>
        <Field>
          <span className="mk-ph">TRACKING</span>
        </Field>
      </div>
    </div>
  )
}

export function MockupStyles() {
  return (
    <style>{`
      @font-face {
        font-family: 'ZeldaII';
        src: url('/fonts/ZELDA-II-THE-ADVENTURE-OF-LINK.TTF') format('truetype');
      }
      .mk-stage {
        position: relative;
        width: ${STAGE_W}px;
        height: ${STAGE_H}px;
        overflow: hidden;
        background: #000;
        font-family: 'ZeldaII', monospace;
        text-transform: uppercase;
      }
      .mk-abs { position: absolute; box-sizing: border-box; }
      .mk-bricks {
        position: absolute;
        inset: 0;
        background-image: url('/overlays/brick-tile.png');
        background-size: ${BW}px ${BH}px;
        image-rendering: pixelated;
      }
      .mk-video {
        background: repeating-linear-gradient(0deg, #000 0 3px, #070707 3px 6px);
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .mk-video-label {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
        color: #2c2c2c;
        font-size: 20px;
        letter-spacing: 2px;
      }
      .mk-video-label small { font-size: 11px; color: #222; }
      .mk-place {
        position: absolute;
        left: 50%;
        bottom: 10px;
        transform: translateX(-50%);
        padding: 6px 14px 4px;
        font-size: 16px;
        letter-spacing: 2px;
        border: 3px solid #000;
        outline: 2px solid #fff;
      }
      .mk-panel {
        background: #000;
        display: flex;
        flex-direction: column;
        font-family: 'ZeldaII', monospace;
      }
      .mk-name {
        position: relative;
        box-sizing: border-box;
        flex-shrink: 0;
        background: #000;
        border: 3px solid var(--accent);
        outline: 2px solid #fff;
        outline-offset: -1px;
        text-align: center;
        color: #8a8a8a;
        font-size: 12px;
        letter-spacing: 1px;
        white-space: nowrap;
      }
      .mk-name::before, .mk-name::after {
        content: "";
        position: absolute;
        top: -5px;
        width: 6px;
        height: 6px;
        background: #d82800;
      }
      .mk-name::before { left: -5px; }
      .mk-name::after { right: -5px; }
      .mk-name span { display: block; }
      .mk-tracker { display: flex; flex-direction: column; }
      .mk-icons { display: grid; }
      .mk-icons img { image-rendering: pixelated; display: block; }
      .mk-lit { filter: none; }
      .mk-dim { filter: grayscale(1) brightness(0.55); opacity: 0.55; }
      .mk-gold {
        color: #ffd700;
        text-decoration: underline;
        letter-spacing: 1px;
        white-space: nowrap;
      }
      .mk-field {
        box-sizing: border-box;
        display: flex;
        align-items: center;
        padding: 0 8px;
        border: 2px solid rgba(255, 215, 0, 0.45);
        border-radius: 2px;
        width: 100%;
      }
      .mk-ph {
        color: rgba(255, 215, 0, 0.4);
        font-size: 12px;
        letter-spacing: 1px;
        white-space: nowrap;
      }
      .mk-timer { color: #fff; letter-spacing: 1px; white-space: nowrap; }
      .mk-info { display: flex; flex-direction: column; height: 100%; padding: 16px 14px; }
    `}</style>
  )
}
