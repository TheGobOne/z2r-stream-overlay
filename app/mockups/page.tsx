import type { Metadata } from "next"
import { MOCKUPS } from "@/components/mockups/layouts"
import { MockupStyles } from "@/components/mockups/parts"
import { ScaleBox } from "@/components/mockups/scale-box"

export const metadata: Metadata = {
  title: "4-Player Layout Mockups",
  description: "Five alternative 4-player overlay layouts",
}

export default function MockupsPage() {
  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <MockupStyles />
      <div className="mx-auto flex max-w-5xl flex-col gap-14">
        <header className="flex flex-col gap-2">
          <h1 className="text-balance text-3xl font-semibold">4-player layout mockups</h1>
          <p className="max-w-2xl text-pretty text-neutral-400">
            Five alternatives drawn at the real 1456 x 816 stage size, using the live brick tile, font and tracker icons.
            Video windows are empty placeholders; place badges (1st, 2nd, 3rd, DNF) are shown inside each window.
          </p>
        </header>

        {MOCKUPS.map((mockup) => (
          <section key={mockup.id} id={mockup.id} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <h2 className="text-xl font-semibold">{mockup.name}</h2>
              <p className="text-pretty text-neutral-400">{mockup.tagline}</p>
            </div>
            <ScaleBox label={`${mockup.name} layout mockup`}>{mockup.render()}</ScaleBox>
            <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-neutral-300">
              {mockup.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </main>
  )
}
