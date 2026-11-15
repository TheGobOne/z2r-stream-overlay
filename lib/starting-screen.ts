/** The starting screen's text, shared by the Booth panel and the /starting-soon pages through localStorage. */
export type StartingData = { p1: string; p2: string; p3: string; p4: string; line: string; title: string }

const KEYS = { duo: "z2r-starting-soon", quad: "z2r-starting-soon-quad" } as const
const mode = (quad: boolean) => (quad ? "quad" : "duo")

export function startingKey(quad: boolean) {
  return KEYS[mode(quad)]
}

/** What is saved, or null when this screen has never been saved in this browser. */
export function readStarting(quad: boolean): StartingData | null {
  try {
    const raw = window.localStorage.getItem(startingKey(quad))
    if (raw === null) return null
    const saved = JSON.parse(raw) as Partial<StartingData> | null
    const text = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback)
    return {
      p1: text(saved?.p1),
      p2: text(saved?.p2),
      p3: text(saved?.p3),
      p4: text(saved?.p4),
      line: text(saved?.line),
      title: text(saved?.title, "STARTING SOON"),
    }
  } catch {
    return null
  }
}

export function writeStarting(quad: boolean, data: StartingData) {
  try {
    window.localStorage.setItem(startingKey(quad), JSON.stringify(data))
  } catch {
    /* private mode or full storage: the screen just keeps its last saved text */
  }
}
