import { BOSSES, ITEMS, type TrackerIcon } from "@/lib/tracker-catalog"
import type { TrackerAction } from "@/lib/tracker-link"

/** A tracker action, or an item location (the badge on an item) that clears itself when sent twice. */
export type ChatAction = TrackerAction | { type: "toggleItemLocation"; id: string; value: string } | { type: "audio"; runners: number[] } | { type: "volume"; runner: number; value: number }
export type ParsedCommand = { action: ChatAction; summary: string }

/** A player is written 1p to 4p. Bare numbers and p1 are palaces, so they never name a player. */
const PLAYER = /^[1-4]p$/i

/** Where an item can be found, as the badge text the overlay shows: towns and palaces 1 to 6. */
const LOCATIONS = new Set(["RA", "RU", "SA", "MD", "NA", "DA", "NK", "OK", "1", "2", "3", "4", "5", "6", "W", "E", "MI", "DM"])

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/** Town names as chat writes them, mapped to the badge text. "New Kasuto" and "Old Kasuto" take two words. */
const TOWNS: Record<string, string> = {
  rauru: "RA",
  ruto: "RU",
  saria: "SA",
  mido: "MD",
  nabooru: "NA",
  darunia: "DA",
  newkasuto: "NK",
  oldkasuto: "OK",
}

/** The badge code for a location typed in chat, or null. */
function resolveLocation(words: string[]): string | null {
  const key = norm(words.join(""))
  if (TOWNS[key]) return TOWNS[key]
  const upper = key.toUpperCase()
  return LOCATIONS.has(upper) ? upper : null
}

/** `!hammer 4`, `!magic key da` or `!magic key new kasuto`: the item's name, then where it was found. */
function parseLocationCommand(command: string, rest: string[]): ParsedCommand | null {
  if (!command.startsWith("!") || rest.length === 0) return null
  const words = [command.slice(1), ...rest]
  // Try the longest location first (two words for "new kasuto"), keeping at least one word for the item
  for (const size of [2, 1]) {
    if (words.length <= size) continue
    const location = resolveLocation(words.slice(-size))
    if (!location) continue
    const icon = findIcon(ITEMS, words.slice(0, -size))
    if (!icon) return null
    return { action: { type: "toggleItemLocation", id: icon.id, value: location }, summary: `${icon.alt}: ${location}` }
  }
  return null
}

/** Short names chat is likely to type. */
const ALIASES: Record<string, string> = {
  horse: "horsehead",
  hh: "horsehead",
  helmet: "helmethead",
  rebo: "rebonack",
  bird: "thunderbird",
  tbird: "thunderbird",
  mk: "magickey",
  key: "magickey",
  anykey: "magickey",
  akey: "magickey",
  mkey: "magickey",
  letter: "noteforriverman",
  note: "noteforriverman",
  riverman: "noteforriverman",
  wol: "wateroflife",
  medicine: "wateroflife",
  child: "kid",
  down: "downstab",
  up: "upstab",
  dstab: "downstab",
  ustab: "upstab",
  jumpspell: "jump",
}

function findIcon(list: TrackerIcon[], words: string[]): TrackerIcon | null {
  const q = norm(words.join(""))
  if (!q) return null
  const byId = list.find((i) => i.id === q || norm(i.alt) === q)
  if (byId) return byId
  const alias = ALIASES[q]
  if (alias) return list.find((i) => i.id === alias) ?? null
  if (q.length >= 3) {
    const starts = list.filter((i) => i.id.startsWith(q) || norm(i.alt).startsWith(q))
    if (starts.length === 1) return starts[0]
  }
  return null
}

/**
 * `!boss horsehead 2` toggles the boss for player 2; the same command again undoes it. `!item` does the same for items.
 * The player number is required. Returns null when the text is not one of these commands,
 * has no valid player number, or does not name a boss or item.
 */
export function parseChatCommand(text: string, runnerCount: number): ParsedCommand | null {
  const parts = text.trim().split(/\s+/)
  const command = (parts.shift() ?? "").toLowerCase()
  // `!sound 1p`: that player has the sound and everyone else is muted. Only one player can have sound at a time.
  if (command === "!sound") {
    if (parts.length !== 1 || !PLAYER.test(parts[0])) return null
    const runner = Number(parts[0][0]) - 1
    if (runner >= runnerCount) return null
    return { action: { type: "audio", runners: [runner] }, summary: `Sound on player ${runner + 1}` }
  }
  // `!volume 1p 50`: that player's audio level, 0 to 100
  if (command === "!volume") {
    if (parts.length !== 2 || !PLAYER.test(parts[0]) || !/^\d{1,3}%?$/.test(parts[1])) return null
    const runner = Number(parts[0][0]) - 1
    const percent = Number.parseInt(parts[1], 10)
    if (runner >= runnerCount || percent > 100) return null
    return { action: { type: "volume", runner, value: percent / 100 }, summary: `Player ${runner + 1} volume ${percent}` }
  }
  const match = /^!(boss|item)$/.exec(command)
  if (!match) return parseLocationCommand(command, parts)
  const isBoss = match[1] === "boss"

  const last = parts.pop() ?? ""
  if (!PLAYER.test(last)) return null
  const runner = Number(last[0]) - 1
  if (runner >= runnerCount) return null

  const icon = findIcon(isBoss ? BOSSES : ITEMS, parts)
  if (!icon) return null
  const action: TrackerAction = { type: isBoss ? "toggleBoss" : "toggleItem", runner, id: icon.id }
  return { action, summary: `Toggled ${icon.alt} for player ${runner + 1}` }
}
