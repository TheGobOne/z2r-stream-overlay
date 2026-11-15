export type RacetimeRunner = {
  name: string
  /** Lowercase Twitch channel the runner linked on racetime.gg, or null. */
  channel: string | null
  /** racetime.gg status: "done" (finished), "dnf", "dq", "in_progress", "ready" and so on. */
  status: string
  /** Finishing place once done, else null. */
  place: number | null
  /** When this runner finished, as a local-clock epoch (ms); null until done. */
  finishedAt: number | null
}

export type RacetimeRace = {
  /** Race room path, like "z2r/gorgeous-megmat-2066". */
  room: string
  status: string
  runners: RacetimeRunner[]
  /** Start of the race as a local-clock epoch (ms), corrected for clock drift; null before it starts. */
  startMs: number | null
  /** End of the race as a local-clock epoch (ms), or null while it is still running. A cancel counts as the end. */
  endMs: number | null
  /** The winner's finish (local-clock epoch, ms), or null when nobody finished. ended_at is the last entrant's end. */
  winnerMs: number | null
  /** finished or cancelled: nothing more will change, so polling can stop. */
  over: boolean
}

// Category slug, then a room slug like "gorgeous-megmat-2066" (so "racetime.gg/user/abc" is rejected)
const ROOM_PATH = /^\/?([a-z0-9_-]+)\/([a-z0-9]+-[a-z0-9]+-\d+)(?:\/.*)?$/i
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
  finished_at?: string | null
}

type RawRace = {
  status?: { value?: string }
  info?: string
  started_at?: string | null
  ended_at?: string | null
  cancelled_at?: string | null
  entrants?: RawEntrant[]
}

/** Reads the public racetime.gg feed for one room. Throws a short message the UI can show. */
export async function fetchRace(room: string): Promise<RacetimeRace> {
  let response: Response
  const before = Date.now()
  try {
    // A stalled request would hold up every later poll, so give up after 8 s
    response = await fetch(`https://racetime.gg/${room}/data`, { cache: "no-store", signal: AbortSignal.timeout(8000) })
  } catch {
    throw new Error("Could not reach racetime.gg")
  }
  if (response.status === 404) throw new Error("That race room was not found")
  if (!response.ok) throw new Error(`racetime.gg answered ${response.status}`)
  const after = Date.now()
  let data: RawRace
  try {
    data = (await response.json()) as RawRace
  } catch {
    // A maintenance or Cloudflare page comes back as HTML
    throw new Error("racetime.gg sent an unexpected reply. Try again in a minute.")
  }

  // racetime.gg's own clock, so the timer stays right even when this computer's clock is off
  const serverNow = Date.parse(response.headers.get("X-Date-Exact") ?? "")
  const offset = Number.isFinite(serverNow) ? serverNow - (before + after) / 2 : 0
  const toLocal = (iso?: string | null) => {
    const ms = iso ? Date.parse(iso) : NaN
    return Number.isFinite(ms) ? ms - offset : null
  }

  if (!data || typeof data !== "object") throw new Error("racetime.gg sent an unexpected reply. Try again in a minute.")
  const runners: RacetimeRunner[] = (Array.isArray(data.entrants) ? data.entrants : [])
    .filter((e): e is RawEntrant => !!e && typeof e === "object")
    .filter((e) => !NOT_RUNNING.has(e.status?.value ?? ""))
    .map((e) => ({
      name: typeof e.user?.name === "string" ? e.user.name : "",
      channel: (
        (typeof e.user?.twitch_name === "string" && e.user.twitch_name) ||
        (typeof e.user?.twitch_channel === "string" && e.user.twitch_channel.split("/").filter(Boolean).pop()) ||
        ""
      ).toLowerCase() || null,
      status: e.status?.value ?? "",
      place: typeof e.place === "number" ? e.place : null,
      finishedAt: e.status?.value === "done" ? toLocal(e.finished_at) : null,
    }))

  // The feed lists entrants alphabetically; room info like "A vs B Game 2" gives the intended order
  const info = typeof data.info === "string" ? data.info : ""
  const firstLine = info.split("\n")[0].toLowerCase()
  const at = findNames(firstLine, runners.map((r) => r.name.toLowerCase()))
  if (runners.length > 1 && at.every((i) => i >= 0)) {
    const order = runners.map((_, i) => i).sort((a, b) => at[a] - at[b])
    const sorted = order.map((i) => runners[i])
    runners.splice(0, runners.length, ...sorted)
  }

  const status = typeof data.status?.value === "string" ? data.status.value : ""
  const finishes = runners.map((r) => r.finishedAt).filter((ms): ms is number => ms !== null)
  return {
    room,
    status,
    runners,
    winnerMs: finishes.length > 0 ? Math.min(...finishes) : null,
    startMs: toLocal(data.started_at),
    // A cancelled race has cancelled_at and no ended_at; stop the clock there too
    endMs: toLocal(data.ended_at) ?? toLocal(data.cancelled_at),
    over: status === "finished" || status === "cancelled",
  }
}

/**
 * Where each name appears in `line` as a whole word, or -1. Longer names claim their spot first,
 * so "bob" can't match inside "bobby".
 */
export function findNames(line: string, names: string[]): number[] {
  const at = names.map(() => -1)
  const taken: [number, number][] = []
  const longestFirst = names.map((_, i) => i).sort((a, b) => names[b].length - names[a].length)
  for (const i of longestFirst) {
    const name = names[i]
    if (!name) continue
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    for (const match of line.matchAll(new RegExp(`(^|[^a-z0-9_])(${escaped})(?=$|[^a-z0-9_])`, "g"))) {
      const start = (match.index ?? 0) + match[1].length
      const end = start + name.length
      if (taken.some(([s, e]) => start < e && end > s)) continue
      taken.push([start, end])
      at[i] = start
      break
    }
  }
  return at
}
