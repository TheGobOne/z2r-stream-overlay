import type { ReactNode } from "react"
import {
  Bar,
  InfoBlock,
  InfoStack,
  NamePlate,
  Panel,
  Tracker,
  Video,
  BH,
  bx,
  by,
  type Place,
} from "@/components/mockups/parts"

const ACCENTS = ["#3050f8", "#d82800", "#00a800", "#f8b800"]
const PLACES: Place[] = [1, 2, 3, "dnf"]
const COLUMNS = [1, 11, 21, 31]

export type Mockup = {
  id: string
  name: string
  tagline: string
  points: string[]
  render: () => ReactNode
}

/** Name plate with the runner's tracker underneath. */
function RunnerCard({
  n,
  cols = 8,
  size = 32,
  gap = 2,
}: {
  n: number
  cols?: number
  size?: number
  gap?: number
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%" }}>
      <NamePlate n={n} accent={ACCENTS[n - 1]} width="100%" height={32} />
      <Tracker cols={cols} size={size} gap={gap} bossCols={6} seed={n} />
    </div>
  )
}

function CardRow({ ids, size = 30, cols = 8 }: { ids: number[]; size?: number; cols?: number }) {
  return (
    <div style={{ display: "flex", gap: 14, width: "100%" }}>
      {ids.map((n) => (
        <div key={n} style={{ flex: 1, minWidth: 0 }}>
          <RunnerCard n={n} size={size} cols={cols} />
        </div>
      ))}
    </div>
  )
}

/** 2x2 grid positions for four 10x10 squares inside the brick border (rows 1-10 and 12-21). */
const QUAD_ROWS = [1, 12]

/* 1. Square Row: four 9x9 squares across the top, each runner's tracker directly underneath. */
function SquareRow() {
  return (
    <>
      {COLUMNS.map((x, i) => (
        <div key={x}>
          <Video n={i + 1} place={PLACES[i]} accent={ACCENTS[i]} x={bx(x)} y={by(1)} w={bx(9)} h={by(9)} />
          <Panel x={bx(x)} y={by(11)} w={bx(9)} h={by(9)} style={{ padding: 12, justifyContent: "center" }}>
            <RunnerCard n={i + 1} size={32} />
          </Panel>
        </div>
      ))}
      <Bar x={bx(1)} y={by(21)} w={bx(39)} h={BH} />
    </>
  )
}

/* 2. Corner Pinwheel: 10x10 squares in the corners, all four trackers and the broadcast info in the middle. */
function CornerPinwheel() {
  const corners = [
    { x: 1, y: 1 },
    { x: 30, y: 1 },
    { x: 1, y: 12 },
    { x: 30, y: 12 },
  ]
  return (
    <>
      {corners.map((c, i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={bx(c.x)}
          y={by(c.y)}
          w={bx(10)}
          h={by(10)}
        />
      ))}
      <Panel x={bx(12)} y={by(1)} w={bx(17)} h={by(21)} style={{ padding: 14, justifyContent: "space-between" }}>
        <CardRow ids={[1, 2]} />
        <div style={{ height: 96, width: "100%" }}>
          <InfoBlock compact />
        </div>
        <CardRow ids={[3, 4]} />
      </Panel>
    </>
  )
}

/* 3. Hero + Three: one runner at 15x15, the other three at 7x7 across the top right. */
function HeroPlusThree() {
  const smallX = [17, 25, 33]
  return (
    <>
      <Video n={1} place={1} accent={ACCENTS[0]} x={bx(1)} y={by(1)} w={bx(15)} h={by(15)} />
      <Panel x={bx(1)} y={by(17)} w={bx(15)} h={by(5)} style={{ padding: 14, justifyContent: "center", gap: 8 }}>
        <NamePlate n={1} accent={ACCENTS[0]} width="100%" height={32} />
        <div style={{ display: "flex", justifyContent: "center" }}>
          <Tracker cols={8} size={30} gap={2} bossCols={3} seed={1} direction="row" />
        </div>
      </Panel>
      {smallX.map((x, i) => (
        <div key={x}>
          <Video
            n={i + 2}
            place={PLACES[i + 1]}
            accent={ACCENTS[i + 1]}
            x={bx(x)}
            y={by(1)}
            w={bx(7)}
            h={by(7)}
          />
          <Panel x={bx(x)} y={by(9)} w={bx(7)} h={by(7)} style={{ padding: 10, justifyContent: "center" }}>
            <RunnerCard n={i + 2} cols={6} size={32} />
          </Panel>
        </div>
      ))}
      <Panel x={bx(17)} y={by(17)} w={bx(23)} h={by(5)} style={{ padding: 14 }}>
        <InfoBlock />
      </Panel>
    </>
  )
}

/* 4. Mirrored Pairs: 9x9 squares on the outer edges, each tracker on the inside next to its video. */
function MirroredPairs() {
  const cells = [
    { v: 1, t: 11, y: 1 },
    { v: 31, t: 21, y: 1 },
    { v: 1, t: 11, y: 11 },
    { v: 31, t: 21, y: 11 },
  ]
  return (
    <>
      {cells.map((c, i) => (
        <div key={i}>
          <Video
            n={i + 1}
            place={PLACES[i]}
            accent={ACCENTS[i]}
            x={bx(c.v)}
            y={by(c.y)}
            w={bx(9)}
            h={by(9)}
          />
          <Panel x={bx(c.t)} y={by(c.y)} w={bx(9)} h={by(9)} style={{ padding: 12, justifyContent: "center" }}>
            <RunnerCard n={i + 1} size={32} />
          </Panel>
        </div>
      ))}
      <Bar x={bx(1)} y={by(21)} w={bx(39)} h={BH} />
    </>
  )
}

/* 5. Left Rail Quad: all four trackers in a rail on the left, a 2x2 of 10x10 squares, broadcast info on the right. */
function LeftRailQuad() {
  const cells = [
    { x: 12, y: 1 },
    { x: 23, y: 1 },
    { x: 12, y: 12 },
    { x: 23, y: 12 },
  ]
  return (
    <>
      <Panel x={bx(1)} y={by(1)} w={bx(10)} h={by(21)} style={{ padding: 12, gap: 8, justifyContent: "space-between" }}>
        {[1, 2, 3, 4].map((n) => (
          <RunnerCard key={n} n={n} size={30} />
        ))}
      </Panel>
      {cells.map((c, i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={bx(c.x)}
          y={by(c.y)}
          w={bx(10)}
          h={by(10)}
        />
      ))}
      <Panel x={bx(34)} y={by(1)} w={bx(6)} h={by(21)}>
        <InfoStack timerSize={22} />
      </Panel>
    </>
  )
}

/* 6. Zigzag: 9x9 squares alternate top and bottom, so every tracker sits above or below its neighbours' videos. */
function Zigzag() {
  return (
    <>
      {COLUMNS.map((x, i) => {
        const top = i % 2 === 0
        return (
          <div key={x}>
            <Video
              n={i + 1}
              place={PLACES[i]}
              accent={ACCENTS[i]}
              x={bx(x)}
              y={by(top ? 1 : 12)}
              w={bx(9)}
              h={by(9)}
            />
            <Panel
              x={bx(x)}
              y={by(top ? 11 : 1)}
              w={bx(9)}
              h={by(10)}
              style={{ padding: 12, justifyContent: "center" }}
            >
              <RunnerCard n={i + 1} size={32} />
            </Panel>
          </div>
        )
      })}
      <Bar x={bx(1)} y={by(22)} w={bx(39)} h={BH} />
    </>
  )
}

/* 7. Edge Pinwheel: 11x11 squares flush to the top and bottom edges, a full-height console between them. */
function EdgePinwheel() {
  const corners = [
    { x: 1, y: 0 },
    { x: 29, y: 0 },
    { x: 1, y: 12 },
    { x: 29, y: 12 },
  ]
  return (
    <>
      {corners.map((c, i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={bx(c.x)}
          y={by(c.y)}
          w={bx(11)}
          h={by(11)}
        />
      ))}
      <Panel x={bx(13)} y={0} w={bx(15)} h={by(23)} style={{ padding: 14, justifyContent: "space-between" }}>
        <CardRow ids={[1, 2]} size={36} cols={6} />
        <div style={{ height: 110, width: "100%" }}>
          <InfoBlock compact />
        </div>
        <CardRow ids={[3, 4]} size={36} cols={6} />
      </Panel>
    </>
  )
}

/* 8. Tracker Quad: a 2x2 of 10x10 squares with a matching 2x2 of trackers beside it. */
function TrackerQuad() {
  const videos = [
    { x: 1, y: 1 },
    { x: 12, y: 1 },
    { x: 1, y: 12 },
    { x: 12, y: 12 },
  ]
  const trackers = [
    { x: 23, y: 1 },
    { x: 32, y: 1 },
    { x: 23, y: 12 },
    { x: 32, y: 12 },
  ]
  return (
    <>
      {videos.map((v, i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={bx(v.x)}
          y={by(v.y)}
          w={bx(10)}
          h={by(10)}
        />
      ))}
      {trackers.map((t, i) => (
        <Panel key={i} x={bx(t.x)} y={by(t.y)} w={bx(8)} h={by(10)} style={{ padding: 12, justifyContent: "center" }}>
          <RunnerCard n={i + 1} size={30} />
        </Panel>
      ))}
      <Bar x={bx(1)} y={by(22)} w={bx(39)} h={BH} />
    </>
  )
}

/* 9. Right Console: a 2x2 of 10x10 squares, with one console holding all trackers and a full info block. */
function RightConsole() {
  const cells = [
    { x: 1, y: 1 },
    { x: 12, y: 1 },
    { x: 1, y: 12 },
    { x: 12, y: 12 },
  ]
  return (
    <>
      {cells.map((c, i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={bx(c.x)}
          y={by(c.y)}
          w={bx(10)}
          h={by(10)}
        />
      ))}
      <Panel x={bx(23)} y={by(1)} w={bx(17)} h={by(21)} style={{ padding: 14, gap: 16, justifyContent: "space-between" }}>
        <CardRow ids={[1, 2]} size={32} />
        <CardRow ids={[3, 4]} size={32} />
        <div style={{ flex: 1, minHeight: 0, width: "100%" }}>
          <InfoBlock />
        </div>
      </Panel>
    </>
  )
}

/* 10. Header + Trackers Above: info bar replaces the top border, trackers sit over 9x9 squares in the lower band. */
function HeaderTrackersAbove() {
  return (
    <>
      <Bar x={bx(1)} y={0} w={bx(39)} h={BH} />
      {COLUMNS.map((x, i) => (
        <div key={x}>
          <Panel x={bx(x)} y={by(2)} w={bx(9)} h={by(10)} style={{ padding: 12, justifyContent: "center" }}>
            <RunnerCard n={i + 1} size={32} />
          </Panel>
          <Video n={i + 1} place={PLACES[i]} accent={ACCENTS[i]} x={bx(x)} y={by(13)} w={bx(9)} h={by(9)} />
        </div>
      ))}
    </>
  )
}

export const MOCKUPS: Mockup[] = [
  {
    id: "square-row",
    name: "1. Square Row",
    tagline: "Four 9 x 9 squares side by side, each runner's tracker directly underneath.",
    points: [
      "Videos: 4 x (9 x 9 bricks), exactly square at 320 x 320 px",
      "Border: full brick frame, with the info bar as a separate strip near the bottom",
      "Easiest to read: every runner is one clean column from video to tracker",
    ],
    render: SquareRow,
  },
  {
    id: "corner-pinwheel",
    name: "2. Corner Pinwheel",
    tagline: "Squares in the four corners, with all trackers and the broadcast info in a console between them.",
    points: [
      "Videos: 4 x (10 x 10 bricks), 355 x 355 px each, the biggest square a bordered 2 x 2 allows",
      "Border: full brick frame and brick gutters around every window",
      "Trackers sit in a block between the videos, with race info and the timer in the middle of it",
    ],
    render: CornerPinwheel,
  },
  {
    id: "hero-plus-three",
    name: "3. Hero + Three",
    tagline: "One runner big and square, the other three smaller and square across the top right.",
    points: [
      "Videos: one 15 x 15 (532 px) and three 7 x 7 (248 px), all exactly square",
      "Border: full brick frame",
      "Needs a way to pick who is featured, since the layout is not symmetrical",
    ],
    render: HeroPlusThree,
  },
  {
    id: "mirrored-pairs",
    name: "4. Mirrored Pairs",
    tagline: "Squares on the outer edges, each tracker on the inside next to its video, mirrored left and right.",
    points: [
      "Videos: 4 x (9 x 9 bricks), exactly square",
      "Border: full brick frame, with the info bar near the bottom",
      "The four trackers cluster in the middle, so comparing progress is one glance",
    ],
    render: MirroredPairs,
  },
  {
    id: "left-rail-quad",
    name: "5. Left Rail Quad",
    tagline: "All four trackers in one rail on the left, a 2 x 2 of squares in the middle, race info on the right.",
    points: [
      "Videos: 4 x (10 x 10 bricks), 355 px each",
      "Border: full brick frame, with black rails on the left and right instead of a bottom bar",
      "Color-coded plates link each tracker to its video",
    ],
    render: LeftRailQuad,
  },
  {
    id: "zigzag",
    name: "6. Zigzag",
    tagline: "Squares alternate between the top and bottom of the screen, with trackers filling the space opposite.",
    points: [
      "Videos: 4 x (9 x 9 bricks), exactly square",
      "Border: top and sides stay bricks; the bottom border is replaced by the info bar",
      "Gives the layout some movement, and each video still has its tracker directly above or below it",
    ],
    render: Zigzag,
  },
  {
    id: "edge-pinwheel",
    name: "7. Edge Pinwheel",
    tagline: "Bigger squares pushed to the top and bottom edges, with a full-height console between them.",
    points: [
      "Videos: 4 x (11 x 11 bricks), 390 px each, the biggest option here",
      "Border: the top and bottom borders are replaced by the videos and console; the sides stay bricks",
      "Trackers and race info all sit in the center column",
    ],
    render: EdgePinwheel,
  },
  {
    id: "tracker-quad",
    name: "8. Tracker Quad",
    tagline: "A 2 x 2 of squares with a matching 2 x 2 of trackers beside it, same positions, same colors.",
    points: [
      "Videos: 4 x (10 x 10 bricks), 355 px each",
      "Border: top and sides stay bricks; the bottom border is replaced by the info bar",
      "Each tracker sits in the same grid position as its video, so the mapping is obvious",
    ],
    render: TrackerQuad,
  },
  {
    id: "right-console",
    name: "9. Right Console",
    tagline: "A 2 x 2 of squares on the left and one console on the right with every tracker plus a full info block.",
    points: [
      "Videos: 4 x (10 x 10 bricks), 355 px each",
      "Border: full brick frame",
      "Race info, commentary, tracking and the timer get a roomy three-column block instead of a thin bar",
    ],
    render: RightConsole,
  },
  {
    id: "header-trackers-above",
    name: "10. Header + Trackers Above",
    tagline: "The info bar replaces the top border, trackers sit in the upper band, and the squares sit below.",
    points: [
      "Videos: 4 x (9 x 9 bricks), exactly square",
      "Border: bottom and sides stay bricks; the top border is replaced by the info bar",
      "Trackers read first, then the gameplay underneath, in four clean columns",
    ],
    render: HeaderTrackersAbove,
  },
]
