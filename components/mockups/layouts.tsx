import type { ReactNode } from "react"
import {
  Bar,
  BrickBox,
  Field,
  Gold,
  InfoBlock,
  InfoStack,
  NamePlate,
  Panel,
  Timer,
  Tracker,
  Video,
  BH,
  STAGE_H,
  STAGE_W,
  bx,
  by,
  type Place,
} from "@/components/mockups/parts"

const ACCENTS = ["#3050f8", "#d82800", "#00a800", "#f8b800"]
const PLACES: Place[] = [1, 2, 3, "dnf"]

export type Mockup = {
  id: string
  name: string
  tagline: string
  points: string[]
  render: () => ReactNode
}

type Rect = { x: number; y: number; w: number; h: number }

/** Name plate with the runner's tracker underneath. */
function RunnerCard({
  n,
  cols = 6,
  size = 34,
  gap = 2,
  bossCols = 6,
}: {
  n: number
  cols?: number
  size?: number
  gap?: number
  bossCols?: number
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      <NamePlate n={n} accent={ACCENTS[n - 1]} width="100%" height={32} />
      <Tracker cols={cols} size={size} gap={gap} bossCols={bossCols} seed={n} />
    </div>
  )
}

/** Four video windows in reading order: P1 top-left, P2 top-right, P3 bottom-left, P4 bottom-right. */
function VideoSet({ boxes }: { boxes: Rect[] }) {
  return (
    <>
      {boxes.map((b, i) => (
        <Video key={i} n={i + 1} place={PLACES[i]} accent={ACCENTS[i]} x={b.x} y={b.y} w={b.w} h={b.h} />
      ))}
    </>
  )
}

function quadBoxes(xs: [number, number], ys: [number, number], w: number, h: number): Rect[] {
  return [
    { x: xs[0], y: ys[0], w, h },
    { x: xs[1], y: ys[0], w, h },
    { x: xs[0], y: ys[1], w, h },
    { x: xs[1], y: ys[1], w, h },
  ]
}

/** One runner's card centered in its own panel, sized to sit beside a video window. */
function RailCard({
  n,
  x,
  y,
  w,
  h,
  size = 34,
  cols = 6,
  bossCols = 6,
  pad = 10,
}: Rect & { n: number; size?: number; cols?: number; bossCols?: number; pad?: number }) {
  return (
    <Panel x={x} y={y} w={w} h={h} style={{ padding: pad, justifyContent: "center" }}>
      <RunnerCard n={n} size={size} cols={cols} bossCols={bossCols} />
    </Panel>
  )
}

function InfoLeft() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "flex-start" }}>
      <Gold>RACE INFO</Gold>
      <Field height={52}>
        <span className="mk-ph">RACE INFO</span>
      </Field>
      <div style={{ paddingTop: 6 }}>
        <Timer size={22} />
      </div>
    </div>
  )
}

function InfoRight() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%", alignItems: "flex-start" }}>
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
    </div>
  )
}

/** A full-height rail: top runner's card, the broadcast fields, then the bottom runner's card. */
function CardRail({
  side,
  x,
  y,
  w,
  h,
  size = 34,
  cols = 6,
  bossCols = 6,
  pad = 12,
}: Rect & { side: "left" | "right"; size?: number; cols?: number; bossCols?: number; pad?: number }) {
  const [top, bottom] = side === "left" ? [1, 3] : [2, 4]
  return (
    <Panel
      x={x}
      y={y}
      w={w}
      h={h}
      style={{ padding: pad, justifyContent: "space-between", alignItems: "center", gap: 12 }}
    >
      <RunnerCard n={top} size={size} cols={cols} bossCols={bossCols} />
      {side === "left" ? <InfoLeft /> : <InfoRight />}
      <RunnerCard n={bottom} size={size} cols={cols} bossCols={bossCols} />
    </Panel>
  )
}

/** The four rail cards beside a 2 x 2: P1/P3 on the left, P2/P4 on the right, aligned to each video row. */
function SideCards({
  leftX,
  rightX,
  w,
  ys,
  h,
  size,
  cols,
  bossCols,
  pad,
}: {
  leftX: number
  rightX: number
  w: number
  ys: [number, number]
  h: number
  size?: number
  cols?: number
  bossCols?: number
  pad?: number
}) {
  const shared = { w, h, size, cols, bossCols, pad }
  return (
    <>
      <RailCard n={1} x={leftX} y={ys[0]} {...shared} />
      <RailCard n={2} x={rightX} y={ys[0]} {...shared} />
      <RailCard n={3} x={leftX} y={ys[1]} {...shared} />
      <RailCard n={4} x={rightX} y={ys[1]} {...shared} />
    </>
  )
}

const CENTER_XS: [number, number] = [bx(9), bx(21)]

/* 1. Center Quad: 11 x 9 windows in the middle, a tracker rail on each side, and the info bar along the bottom. */
function CenterQuad() {
  const ys: [number, number] = [by(1), by(11)]
  return (
    <>
      <VideoSet boxes={quadBoxes(CENTER_XS, ys, bx(11), by(9))} />
      <SideCards leftX={bx(1)} rightX={bx(33)} w={bx(7)} ys={ys} h={by(9)} />
      <Bar x={bx(1)} y={by(21)} w={bx(39)} h={BH} />
    </>
  )
}

/* 2. Wide Quad: 12 x 10 windows with slim rails that also carry the broadcast fields. */
function WideQuad() {
  return (
    <>
      <VideoSet boxes={quadBoxes([bx(8), bx(21)], [by(1), by(12)], bx(12), by(10))} />
      <CardRail side="left" x={bx(1)} y={by(1)} w={bx(6)} h={by(21)} size={30} />
      <CardRail side="right" x={bx(34)} y={by(1)} w={bx(6)} h={by(21)} size={30} />
    </>
  )
}

/* 3. Center Band: two rows of windows with the info band sandwiched between them. */
function CenterBand() {
  const ys: [number, number] = [by(1), by(13)]
  return (
    <>
      <VideoSet boxes={quadBoxes(CENTER_XS, ys, bx(11), by(9))} />
      <SideCards leftX={bx(1)} rightX={bx(33)} w={bx(7)} ys={ys} h={by(9)} />
      <Panel x={bx(9)} y={by(10)} w={bx(23)} h={by(3)} style={{ padding: 14 }}>
        <InfoBlock compact />
      </Panel>
    </>
  )
}

/* 4. Black Rails: solid black rails run to the screen edges and replace the side borders. */
function BlackRails() {
  return (
    <>
      <VideoSet boxes={quadBoxes(CENTER_XS, [by(1), by(12)], bx(11), by(10))} />
      <CardRail side="left" x={0} y={0} w={bx(8)} h={STAGE_H} size={34} cols={7} pad={14} />
      <CardRail side="right" x={bx(33)} y={0} w={bx(8)} h={STAGE_H} size={34} cols={7} pad={14} />
    </>
  )
}

/* 5. Header Bar: the info bar replaces the top border and the windows run flush to the bottom edge. */
function HeaderBar() {
  const ys: [number, number] = [by(2), by(13)]
  return (
    <>
      <Bar x={0} y={0} w={STAGE_W} h={BH} />
      <VideoSet boxes={quadBoxes(CENTER_XS, ys, bx(11), by(10))} />
      <SideCards leftX={bx(1)} rightX={bx(33)} w={bx(7)} ys={ys} h={by(10)} />
    </>
  )
}

/* 6. Offset Quad: the right column drops two rows, and the empty corners hold the broadcast fields. */
function OffsetQuad() {
  const w = bx(11)
  const h = by(9)
  const boxes: Rect[] = [
    { x: bx(9), y: by(1), w, h },
    { x: bx(21), y: by(3), w, h },
    { x: bx(9), y: by(11), w, h },
    { x: bx(21), y: by(13), w, h },
  ]
  return (
    <>
      <VideoSet boxes={boxes} />
      <RailCard n={1} x={bx(1)} y={by(1)} w={bx(7)} h={h} />
      <RailCard n={3} x={bx(1)} y={by(11)} w={bx(7)} h={h} />
      <RailCard n={2} x={bx(33)} y={by(3)} w={bx(7)} h={h} />
      <RailCard n={4} x={bx(33)} y={by(13)} w={bx(7)} h={h} />
      <Panel
        x={bx(21)}
        y={by(1)}
        w={w}
        h={by(2)}
        style={{ flexDirection: "row", alignItems: "center", gap: 14, padding: "0 12px" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field height={28}>
            <span className="mk-ph">RACE INFO</span>
          </Field>
        </div>
        <Timer size={18} />
      </Panel>
      <Panel
        x={bx(9)}
        y={by(20)}
        w={w}
        h={by(2)}
        style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, padding: "4px 10px", alignContent: "center" }}
      >
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
      </Panel>
    </>
  )
}

/* 7. Tracker Column: every tracker stacked in the left rail, every broadcast field in the right rail. */
function TrackerColumn() {
  return (
    <>
      <VideoSet boxes={quadBoxes(CENTER_XS, [by(1), by(12)], bx(11), by(10))} />
      <Panel x={bx(1)} y={by(1)} w={bx(7)} h={by(21)} style={{ padding: 8, justifyContent: "space-between", gap: 8 }}>
        {[1, 2, 3, 4].map((n) => (
          <RunnerCard key={n} n={n} size={27} cols={8} />
        ))}
      </Panel>
      <Panel x={bx(33)} y={by(1)} w={bx(7)} h={by(21)}>
        <InfoStack timerSize={22} />
      </Panel>
    </>
  )
}

/* 8. Letterbox: black bars run edge to edge along the top and bottom and replace those borders. */
function Letterbox() {
  const ys: [number, number] = [by(2), by(12)]
  const strip = {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 20,
    padding: "0 20px",
  }
  return (
    <>
      <Panel x={0} y={0} w={STAGE_W} h={BH} style={strip}>
        <div style={{ flex: 1.6, minWidth: 0 }}>
          <Field height={24}>
            <span className="mk-ph">RACE INFO</span>
          </Field>
        </div>
        <Gold>COMMENTARY</Gold>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field height={24}>
            <span className="mk-ph">COM 1</span>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field height={24}>
            <span className="mk-ph">COM 2</span>
          </Field>
        </div>
      </Panel>
      <VideoSet boxes={quadBoxes(CENTER_XS, ys, bx(11), by(9))} />
      <SideCards leftX={bx(1)} rightX={bx(33)} w={bx(7)} ys={ys} h={by(9)} />
      <Panel x={0} y={by(22)} w={STAGE_W} h={BH} style={strip}>
        <Gold>TRACKING</Gold>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field height={24}>
            <span className="mk-ph">TRACKING</span>
          </Field>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field height={24}>
            <span className="mk-ph">TRACKING</span>
          </Field>
        </div>
        <Timer size={16} />
      </Panel>
    </>
  )
}

/* 9. Brick Wall: the stage is black, and the bricks survive only as one wall with four windows cut into it. */
function BrickWall() {
  return (
    <>
      <Panel x={0} y={0} w={STAGE_W} h={STAGE_H} />
      <BrickBox x={bx(7)} y={0} w={bx(27)} h={STAGE_H} />
      <VideoSet boxes={quadBoxes([bx(8), bx(21)], [by(1), by(12)], bx(12), by(10))} />
      <CardRail side="left" x={0} y={0} w={bx(7)} h={STAGE_H} size={34} pad={14} />
      <CardRail side="right" x={bx(34)} y={0} w={bx(7)} h={STAGE_H} size={34} pad={14} />
    </>
  )
}

/* 10. Center Spine: square windows either side of a slim info column, with narrow tracker rails outside. */
function CenterSpine() {
  const ys: [number, number] = [by(1), by(12)]
  return (
    <>
      <VideoSet boxes={quadBoxes([bx(7), bx(24)], ys, bx(10), by(10))} />
      <SideCards
        leftX={bx(1)}
        rightX={bx(35)}
        w={bx(5)}
        ys={ys}
        h={by(10)}
        size={30}
        cols={5}
        bossCols={3}
        pad={8}
      />
      <Panel x={bx(18)} y={by(1)} w={bx(5)} h={by(21)}>
        <InfoStack timerSize={20} />
      </Panel>
    </>
  )
}

export const MOCKUPS: Mockup[] = [
  {
    id: "center-quad",
    name: "1. Center Quad",
    tagline: "Four windows packed into the middle, a tracker rail on each side, the info bar along the bottom.",
    points: [
      "Windows: 4 x (11 x 9 bricks), about 391 x 319 px, 1.22 : 1",
      "Border: full brick frame, with the info bar as a strip inside it",
      "Each tracker sits beside its own window, so left and right rails map to rows",
    ],
    render: CenterQuad,
  },
  {
    id: "wide-quad",
    name: "2. Wide Quad",
    tagline: "The biggest windows: slim rails take the trackers and carry the broadcast fields too.",
    points: [
      "Windows: 4 x (12 x 10 bricks), about 426 x 355 px, 1.20 : 1",
      "Border: full brick frame, no bottom bar needed",
      "Left rail: P1, race info and timer, P3. Right rail: P2, commentary and tracking, P4",
    ],
    render: WideQuad,
  },
  {
    id: "center-band",
    name: "3. Center Band",
    tagline: "Two rows of windows with the broadcast info sandwiched in the gap between them.",
    points: [
      "Windows: 4 x (11 x 9 bricks), about 391 x 319 px, 1.22 : 1",
      "Border: full brick frame, with the info band replacing the middle gutter",
      "Keeps the whole bottom edge clean, and the band reads like a scoreboard between the runs",
    ],
    render: CenterBand,
  },
  {
    id: "black-rails",
    name: "4. Black Rails",
    tagline: "Solid black rails run to the screen edges and replace the side borders; bricks frame the center.",
    points: [
      "Windows: 4 x (11 x 10 bricks), about 391 x 355 px, 1.10 : 1",
      "Border: top, bottom and gutters stay brick; the left and right borders become black rails",
      "Bigger tracker icons since each rail is 8 bricks wide",
    ],
    render: BlackRails,
  },
  {
    id: "header-bar",
    name: "5. Header Bar",
    tagline: "The info bar replaces the top border and the windows run right down to the bottom edge.",
    points: [
      "Windows: 4 x (11 x 10 bricks), about 391 x 355 px, 1.10 : 1",
      "Border: the top becomes a full-width info bar and the bottom border is dropped for more window height",
      "Side rails stay brick-framed and line up with each window",
    ],
    render: HeaderBar,
  },
  {
    id: "offset-quad",
    name: "6. Offset Quad",
    tagline: "The right column drops two rows, and the empty corners that leaves hold the broadcast fields.",
    points: [
      "Windows: 4 x (11 x 9 bricks), about 391 x 319 px, 1.22 : 1",
      "Border: full brick frame",
      "The staggered grid breaks up the boxy look, and the fields sit right where eyes land",
    ],
    render: OffsetQuad,
  },
  {
    id: "tracker-column",
    name: "7. Tracker Column",
    tagline: "All four trackers stacked in the left rail, all broadcast fields in the right rail.",
    points: [
      "Windows: 4 x (11 x 10 bricks), about 391 x 355 px, 1.10 : 1",
      "Border: full brick frame",
      "Comparing runner progress is a single vertical scan, and the colors tie each tracker to its window",
    ],
    render: TrackerColumn,
  },
  {
    id: "letterbox",
    name: "8. Letterbox",
    tagline: "Black bars along the top and bottom edges replace those borders and split the broadcast info.",
    points: [
      "Windows: 4 x (11 x 9 bricks), about 391 x 319 px, 1.22 : 1",
      "Border: top and bottom borders become full-width bars; the sides stay brick",
      "Top bar: race info and commentary. Bottom bar: tracking and the timer",
    ],
    render: Letterbox,
  },
  {
    id: "brick-wall",
    name: "9. Brick Wall",
    tagline: "The stage turns black and the bricks only remain as a wall with four windows cut into it.",
    points: [
      "Windows: 4 x (12 x 10 bricks), about 426 x 355 px, 1.20 : 1",
      "Border: inverted. The bricks are the frame around the windows; everything else is black",
      "The most dramatic option, since the gameplay becomes a single glowing block in the middle",
    ],
    render: BrickWall,
  },
  {
    id: "center-spine",
    name: "10. Center Spine",
    tagline: "Square windows either side of a slim info column, with narrow tracker rails outside.",
    points: [
      "Windows: 4 x (10 x 10 bricks), about 355 x 355 px, 1 : 1",
      "Border: full brick frame",
      "The timer and fields sit dead center between the pairs, trackers go outside",
    ],
    render: CenterSpine,
  },
]
