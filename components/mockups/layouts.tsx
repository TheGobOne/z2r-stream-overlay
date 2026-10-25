import type { ReactNode } from "react"
import {
  Abs,
  Bar,
  Gold,
  InfoStack,
  NamePlate,
  Field,
  Panel,
  Timer,
  Tracker,
  Video,
  BH,
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

/* 1. Center Spine: videos on the outside, all four trackers in a column between them. */
function CenterSpine() {
  const rows = [1, 12]
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          x={i % 2 === 0 ? bx(1) : bx(27)}
          y={by(rows[Math.floor(i / 2)])}
          w={bx(13)}
          h={by(10)}
        />
      ))}
      {rows.map((row, r) => (
        <Panel
          key={row}
          x={bx(15)}
          y={by(row)}
          w={bx(11)}
          h={by(10)}
          style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 14 }}
        >
          {[0, 1].map((c) => {
            const n = r * 2 + c
            return (
              <div key={c} style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
                <NamePlate n={n + 1} width={183} />
                <Tracker cols={6} size={28} gap={3} seed={n} />
              </div>
            )
          })}
        </Panel>
      ))}
      <Bar x={bx(1)} y={by(22)} w={bx(39)} h={BH} />
    </>
  )
}

/* 2. Tracker Rail: 2x2 videos at left, one tall rail on the right holding four stacked color-coded tracker strips. */
function TrackerRail() {
  const rows = [1, 12]
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={i % 2 === 0 ? bx(1) : bx(15)}
          y={by(rows[Math.floor(i / 2)])}
          w={bx(13)}
          h={by(10)}
        />
      ))}
      <Panel x={bx(29)} y={by(1)} w={bx(11)} h={by(21)} style={{ padding: 14, gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <NamePlate n={i + 1} accent={ACCENTS[i]} width="100%" height={30} />
            <Tracker cols={12} size={28} gap={2} bossCols={6} seed={i} align="flex-start" />
          </div>
        ))}
        <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <Field height={26}>
            <span className="mk-ph">RACE INFO</span>
          </Field>
          <Timer size={26} />
        </div>
      </Panel>
      <Bar x={bx(1)} y={by(22)} w={bx(39)} h={BH} />
    </>
  )
}

/* 3. Strip Below: bigger 16:9 videos, each with its own horizontal tracker strip underneath, broadcast info at the right. */
function StripBelow() {
  const rowsY = [0, 12]
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const x = i % 2 === 0 ? bx(1) : bx(17)
        const y = by(rowsY[Math.floor(i / 2)])
        return (
          <div key={i}>
            <Video n={i + 1} place={PLACES[i]} x={x} y={y} w={bx(15)} h={by(9)} />
            <Panel
              x={x}
              y={y + by(9)}
              w={bx(15)}
              h={by(2)}
              style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "0 6px" }}
            >
              <NamePlate n={i + 1} width={118} height={32} fontSize={10} />
              <Tracker cols={12} size={24} gap={2} bossCols={3} seed={i} align="flex-start" direction="row" />
            </Panel>
          </div>
        )
      })}
      <Panel x={bx(33)} y={0} w={bx(7)} h={by(23)}>
        <InfoStack timerSize={26} />
      </Panel>
    </>
  )
}

/* 4. Hero + Three: one featured runner large, the other three smaller along the bottom with slim trackers. */
function HeroPlusThree() {
  const cellX = [bx(1), bx(14), bx(27)]
  return (
    <>
      <Video n={1} place={1} x={bx(1)} y={0} w={bx(17)} h={by(13)} />
      <Panel x={bx(19)} y={0} w={bx(20)} h={by(13)} style={{ flexDirection: "row", padding: 16, gap: 18 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, justifyContent: "center", alignItems: "center" }}>
          <Gold size={12}>FEATURED RUNNER</Gold>
          <NamePlate n={1} width={373} height={40} />
          <Tracker cols={8} size={44} gap={3} bossCols={6} seed={0} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <InfoStack timerSize={30} gap={8} />
        </div>
      </Panel>
      {cellX.map((x, i) => (
        <div key={i}>
          <Video n={i + 2} place={PLACES[i + 1]} x={x} y={by(14)} w={bx(9)} h={by(7)} />
          <Panel
            x={x + bx(9)}
            y={by(14)}
            w={bx(3)}
            h={by(7)}
            style={{ alignItems: "center", justifyContent: "center", gap: 6 }}
          >
            <NamePlate n={i + 2} width={56} height={26} short />
            <Tracker cols={4} size={22} gap={2} bossCols={4} seed={i + 1} />
          </Panel>
        </div>
      ))}
      <Bar x={bx(1)} y={by(22)} w={bx(38)} h={BH} />
    </>
  )
}

/* 5. Dock + Console: largest possible 16:9 videos, trackers as four docks along the bottom, broadcast info in a center console. */
function DockConsole() {
  const rowsY = [0, 9]
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={i % 2 === 0 ? bx(1) : bx(26)}
          y={by(rowsY[Math.floor(i / 2)])}
          w={bx(14)}
          h={by(8)}
        />
      ))}
      <Panel x={bx(16)} y={0} w={bx(9)} h={by(17)}>
        <InfoStack timerSize={34} gap={12} />
      </Panel>
      {[0, 1, 2, 3].map((i) => (
        <Panel
          key={i}
          x={bx(1 + i * 10)}
          y={by(18)}
          w={bx(9)}
          h={by(5)}
          style={{ padding: 7, gap: 8, alignItems: "center" }}
        >
          <NamePlate n={i + 1} accent={ACCENTS[i]} width="100%" height={30} />
          <Tracker cols={11} size={26} gap={2} bossCols={6} seed={i} />
        </Panel>
      ))}
    </>
  )
}

/* Name plate centered on the bricks directly under a video. */
function PlateRow({ n, accent, x, y, w }: { n: number; accent?: string; x: number; y: number; w: number }) {
  return (
    <Abs x={x} y={y} w={w} h={BH} style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
      <NamePlate n={n} accent={accent} width={Math.min(w - 24, 220)} height={26} />
    </Abs>
  )
}

/* 6. Framed Strips: full brick border, 1-brick gutters, each tracker strip under its own video, info column at right. */
function FramedStrips() {
  const colX = [bx(1), bx(16)]
  const rowY = [by(1), by(12)]
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const x = colX[i % 2]
        const y = rowY[Math.floor(i / 2)]
        return (
          <div key={i}>
            <Video n={i + 1} place={PLACES[i]} x={x} y={y} w={bx(14)} h={by(8)} />
            <Panel
              x={x}
              y={y + by(8)}
              w={bx(14)}
              h={by(2)}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, padding: "0 6px" }}
            >
              <NamePlate n={i + 1} width={100} height={32} fontSize={10} />
              <Tracker cols={12} size={21} gap={2} bossCols={3} seed={i} direction="row" />
            </Panel>
          </div>
        )
      })}
      <Panel x={bx(31)} y={by(1)} w={bx(9)} h={by(21)}>
        <InfoStack timerSize={28} />
      </Panel>
    </>
  )
}

/* 7. Quadrant Cards: brick border plus a brick cross; each card is video + name plate with its tracker facing the center. Bottom border becomes the info bar. */
function QuadrantCards() {
  const rowY = [by(1), by(11)]
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const left = i % 2 === 0
        const y = rowY[Math.floor(i / 2)]
        const videoX = left ? bx(1) : bx(26)
        const trackerX = left ? bx(15) : bx(21)
        return (
          <div key={i}>
            <Video n={i + 1} place={PLACES[i]} x={videoX} y={y} w={bx(14)} h={by(8)} />
            <PlateRow n={i + 1} x={videoX} y={y + by(8)} w={bx(14)} />
            <Panel
              x={trackerX}
              y={y}
              w={bx(5)}
              h={by(9)}
              style={{ alignItems: "center", justifyContent: "center", padding: 8 }}
            >
              <Tracker cols={6} size={24} gap={2} bossCols={6} seed={i} />
            </Panel>
          </div>
        )
      })}
      <Bar x={0} y={by(21)} w={bx(41)} h={by(2)} />
    </>
  )
}

/* 8. Side Rails: the left and right borders become tracker rails; videos and plates sit on bricks between them. */
function SideRails() {
  const colX = [bx(6), bx(21)]
  const rowY = [by(1), by(11)]
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const x = colX[i % 2]
        const y = rowY[Math.floor(i / 2)]
        return (
          <div key={i}>
            <Video n={i + 1} place={PLACES[i]} accent={ACCENTS[i]} x={x} y={y} w={bx(14)} h={by(8)} />
            <PlateRow n={i + 1} accent={ACCENTS[i]} x={x} y={y + by(8)} w={bx(14)} />
          </div>
        )
      })}
      {[0, 1].map((side) => (
        <Panel
          key={side}
          x={side === 0 ? 0 : bx(36)}
          y={0}
          w={bx(5)}
          h={by(23)}
          style={{ alignItems: "center", justifyContent: "space-around", padding: "14px 8px" }}
        >
          {[0, 1].map((row) => {
            const n = row * 2 + side
            return (
              <div key={row} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <NamePlate n={n + 1} accent={ACCENTS[n]} width={72} height={30} short />
                <Tracker cols={6} size={24} gap={2} bossCols={6} seed={n} />
              </div>
            )
          })}
        </Panel>
      ))}
      <Bar x={bx(6)} y={by(21)} w={bx(29)} h={BH} />
    </>
  )
}

/* 9. Featured Stack: full border, one large featured runner on the left, three runners stacked at right each with a tracker beside it. Bottom border becomes the info bar. */
function FeaturedStack() {
  const cellY = [by(1), by(8), by(15)]
  return (
    <>
      <Video n={1} place={1} x={bx(1)} y={by(1)} w={bx(22)} h={by(12)} />
      <Panel
        x={bx(1)}
        y={by(14)}
        w={bx(22)}
        h={by(7)}
        style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 28, padding: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <Gold size={12}>FEATURED RUNNER</Gold>
          <NamePlate n={1} width={220} height={36} />
          <Timer size={30} />
        </div>
        <Tracker cols={8} size={30} gap={2} bossCols={8} seed={0} />
      </Panel>
      {cellY.map((y, i) => (
        <div key={i}>
          <Video n={i + 2} place={PLACES[i + 1]} x={bx(24)} y={y} w={bx(9)} h={by(5)} />
          <PlateRow n={i + 2} x={bx(24)} y={y + by(5)} w={bx(9)} />
          <Panel
            x={bx(33)}
            y={y}
            w={bx(7)}
            h={by(6)}
            style={{ alignItems: "center", justifyContent: "center", padding: 8 }}
          >
            <Tracker cols={8} size={26} gap={2} bossCols={6} seed={i + 1} />
          </Panel>
        </div>
      ))}
      <Bar x={0} y={by(22)} w={bx(41)} h={BH} />
    </>
  )
}

/* 10. Center Ribbon: videos in the four corners with a color-coded tracker ribbon through the middle; info fills the gaps between the videos. */
function CenterRibbon() {
  const colX = [bx(1), bx(26)]
  const rowY = [by(1), by(14)]
  return (
    <>
      {[0, 1, 2, 3].map((i) => (
        <Video
          key={i}
          n={i + 1}
          place={PLACES[i]}
          accent={ACCENTS[i]}
          x={colX[i % 2]}
          y={rowY[Math.floor(i / 2)]}
          w={bx(14)}
          h={by(8)}
        />
      ))}
      <Panel x={bx(16)} y={by(1)} w={bx(9)} h={by(8)} style={{ padding: "14px 12px", gap: 10 }}>
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
      </Panel>
      <Panel x={bx(16)} y={by(14)} w={bx(9)} h={by(8)} style={{ padding: "14px 12px", gap: 10 }}>
        <Gold>TRACKING</Gold>
        <Field>
          <span className="mk-ph">TRACKING</span>
        </Field>
        <Field>
          <span className="mk-ph">TRACKING</span>
        </Field>
        <div style={{ marginTop: "auto", textAlign: "center" }}>
          <Timer size={34} />
        </div>
      </Panel>
      <Panel
        x={bx(1)}
        y={by(10)}
        w={bx(39)}
        h={by(3)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10, padding: "0 10px" }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <NamePlate n={i + 1} accent={ACCENTS[i]} width={56} height={30} short />
            <Tracker cols={8} size={21} gap={2} bossCols={3} seed={i} direction="row" />
          </div>
        ))}
      </Panel>
    </>
  )
}

export const MOCKUPS: Mockup[] = [
  {
    id: "spine",
    name: "1. Center Spine",
    tagline: "Videos go to the outer edges; all four trackers live in one brick column down the middle.",
    points: [
      "Each tracker sits between its own video and the opposite runner's, so you read left to right",
      "Videos stay close to the current size, so no crop changes are needed",
      "Race info stays in the bottom bar",
    ],
    render: CenterSpine,
  },
  {
    id: "rail",
    name: "2. Tracker Rail",
    tagline: "A single tall rail on the right holds four stacked trackers, color-coded to match a frame around each video.",
    points: [
      "Frees the video area from trackers entirely, so the 2x2 grid reads as one clean block",
      "Colored frames and name plates link each runner to their tracker at a glance",
      "Items sit in a compact 12-wide grid, so the icons are a little smaller than they are today",
    ],
    render: TrackerRail,
  },
  {
    id: "strip",
    name: "3. Strip Below",
    tagline: "Bigger 16:9 videos, with each runner's tracker on a horizontal strip directly underneath.",
    points: [
      "Biggest videos of the side-by-side options, and nothing sits beside them",
      "A tracker always sits right under its own video, so it is never ambiguous",
      "Commentary, tracking and timer move into a slim column on the right",
    ],
    render: StripBelow,
  },
  {
    id: "hero",
    name: "4. Hero + Three",
    tagline: "One featured runner is shown large, with the other three smaller along the bottom.",
    points: [
      "Good when you want to follow one runner or the race leader and still keep an eye on the rest",
      "The featured runner gets large 44px tracker icons and the broadcast info",
      "Not symmetrical, so you would need a way to switch who is featured",
    ],
    render: HeroPlusThree,
  },
  {
    id: "dock",
    name: "5. Dock + Console",
    tagline: "Videos stay as big as possible, trackers form a dock across the bottom, and the broadcast info moves to a center console.",
    points: [
      "Videos have nothing inside or beside them except the center console",
      "Four equal tracker docks make runners easy to compare at a glance",
      "Removes the bottom bar, so there is more room for the videos and trackers",
    ],
    render: DockConsole,
  },
  {
    id: "framed-strips",
    name: "6. Framed Strips",
    tagline: "Full brick border on all four sides, with every tracker strip directly under its own video.",
    points: [
      "Border: one unbroken brick frame around the whole overlay, plus a brick gutter between every window",
      "Videos are 14 x 8 bricks, a little smaller than option 3 because the border and gutters take space",
      "Race info, commentary, tracking and timer sit in a tall panel at the right",
    ],
    render: FramedStrips,
  },
  {
    id: "quadrant-cards",
    name: "7. Quadrant Cards",
    tagline: "A brick border and a brick cross split the screen into four cards, with the trackers facing the center.",
    points: [
      "Border: full brick frame and cross on top, with the bottom border replaced by a 2-brick info bar",
      "Each card is a video, a name plate underneath, and its own tracker on the side nearest the center",
      "Left and right cards mirror each other, so the four trackers cluster around the middle",
    ],
    render: QuadrantCards,
  },
  {
    id: "side-rails",
    name: "8. Side Rails",
    tagline: "The left and right borders become tracker rails; the videos sit between them on a brick background.",
    points: [
      "Border: bricks stay on top, bottom and between the videos; the side borders are replaced by black rails",
      "Left rail holds runners 1 and 3, right rail holds runners 2 and 4, next to their videos",
      "Color-coded frames and name plates link each video to its tracker",
    ],
    render: SideRails,
  },
  {
    id: "featured-stack",
    name: "9. Featured Stack",
    tagline: "One large featured runner on the left, with the other three stacked on the right, each with a tracker beside it.",
    points: [
      "Border: full brick frame with a 1-brick gutter between windows; the bottom border becomes the info bar",
      "The featured runner gets a big video, large 30px tracker icons and the timer",
      "You would need a way to switch who is featured, since the layout is not symmetrical",
    ],
    render: FeaturedStack,
  },
  {
    id: "center-ribbon",
    name: "10. Center Ribbon",
    tagline: "Videos in the four corners, a color-coded tracker ribbon across the middle, and the broadcast info between the videos.",
    points: [
      "Border: full brick frame and brick gutters around the ribbon and every video",
      "All four trackers line up in one band, so comparing progress is a single glance",
      "No bottom bar is needed, since race info and commentary sit beside the top videos and tracking and timer beside the bottom ones",
    ],
    render: CenterRibbon,
  },
]
