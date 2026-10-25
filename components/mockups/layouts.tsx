import type { ReactNode } from "react"
import {
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
]
