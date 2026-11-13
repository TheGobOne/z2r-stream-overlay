export type RacetimeRunner = {
  name: string
  /** Lowercase Twitch channel the runner linked on racetime.gg, or null. */
  channel: string | null
  /** racetime.gg status: "done" (finished), "dnf", "dq", "in_progress", "ready" and so on. */
  status: string
  /** Finishing place once done, else null. */
  place: number | null
}

export type RacetimeRace = {
  /** Race room path, like "z2r/gorgeous-megmat-2066". */
  room: string
  status: string
  info: string
  runners: RacetimeRunner[]
  /** Scheduled or actual start as a local-clock epoch (ms), corrected for clock drift; null before one is set. */
  startMs: number | null
  /** End of the race as a local-clock epoch (ms), or null while it is still running. */
  endMs: number | null
}

const ROOM_PATH = /^\/?([a-z0-9_-]+)\/([a-z0-9_-]+)(?:\/.*)?$/i
const NOT_RUNNING = new Set(["invited", "declined", "requested"])

/** Accepts a racetime.gg room link, "racetime.gg/z2r/room", or "z2r/room". */
export function parseRoom(input: string): string | null {
  const text = input.trim()
  if (!text) return null
  let path = text
  if (/^https?:\/\//i.test(text) || /^(www\.)?racetime\.gg\//i.test(text)) {
    try {
      const url = new URL(text.startsWith("http") ? text : `https://${text}`)
      if (!/(^|\.)racetime\.gg$/i.test(url.hostname)) return null
      path = url.pathname
    } catch {
      return null
    }
  }
  const match = ROOM_PATH.exec(path)
  if (!match) return null
  return `${match[1].toLowerCase()}/${match[2].toLowerCase()}`
}

type RawEntrant = {
  user?: { name?: string; twitch_name?: string | null; twitch_channel?: string | null }
  status?: { value?: string }
  place?: number | null
}

type RawRace = {
  status?: { value?: string }
  info?: string
  started_at?: string | null
  starts_at?: string | null
  ended_at?: string | null
  entrants?: RawEntrant[]
}

/** Reads the public racetime.gg feed for one room. Throws a short message the UI can show. */
export async function fetchRace(room: string): Promise<RacetimeRace> {
  let response: Response
  const before = Date.now()
  try {
    response = await fetch(`https://racetime.gg/${room}/data`, { cache: "no-store" })
  } catch {
    throw new Error("Could not reach racetime.gg")
  }
  if (response.status === 404) throw new Error("That race room was not found")
  if (!response.ok) throw new Error(`racetime.gg answered ${response.status}`)
  const after = Date.now()
  const data = (await response.json()) as RawRace

  // racetime.gg's own clock, so the timer stays right even when this computer's clock is off
  const serverNow = Date.parse(response.headers.get("X-Date-Exact") ?? "")
  const offset = Number.isFinite(serverNow) ? serverNow - (before + after) / 2 : 0
  const toLocal = (iso?: string | null) => {
    const ms = iso ? Date.parse(iso) : NaN
    return Number.isFinite(ms) ? ms - offset : null
  }

  const runners: RacetimeRunner[] = (data.entrants ?? [])
    .filter((e) => !NOT_RUNNING.has(e.status?.value ?? ""))
    .map((e) => ({
      name: e.user?.name ?? "",
      channel: (e.user?.twitch_name || e.user?.twitch_channel?.split("/").filter(Boolean).pop() || "").toLowerCase() || null,
      status: e.status?.value ?? "",
      place: typeof e.place === "number" ? e.place : null,
    }))

  // The feed lists entrants alphabetically; room info like "A vs B Game 2" gives the intended order
  const info = data.info ?? ""
  const firstLine = info.split("\n")[0].toLowerCase()
  const at = runners.map((r) => (r.name ? firstLine.indexOf(r.name.toLowerCase()) : -1))
  if (runners.length > 1 && at.every((i) => i >= 0)) {
    const order = runners.map((_, i) => i).sort((a, b) => at[a] - at[b])
    const sorted = order.map((i) => runners[i])
    runners.splice(0, runners.length, ...sorted)
  }

  return {
    room,
    status: data.status?.value ?? "",
    info,
    runners,
    startMs: toLocal(data.started_at ?? data.starts_at),
    endMs: toLocal(data.ended_at),
  }
}
