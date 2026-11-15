import { BOSSES, ITEMS, type TrackerIcon } from "@/lib/tracker-catalog"
import type { TrackerAction } from "@/lib/tracker-link"

/** A tracker action, or an item location (the badge on an item) that clears itself when sent twice. */
export type ChatAction = TrackerAction | { type: "toggleItemLocation"; id: string; value: string }
export type ParsedCommand = { action: ChatAction; summary: string }

/** Where an item can be found, as the badge text the overlay shows: towns and palaces 1 to 6. */
const LOCATIONS = new Set(["RA", "RU", "SA", "MD", "NA", "DA", "NK", "OK", "1", "2", "3", "4", "5", "6", "W", "E", "MI", "DM"])

/** `!hammer 4` or `!magic key da`: the item's name, then where it was found. */
function parseLocationCommand(command: string, rest: string[]): ParsedCommand | null {
  if (!command.startsWith("!") || rest.length === 0) return null
  const words = [command.slice(1), ...rest]
  const location = (words.pop() ?? "").toUpperCase()
  if (!LOCATIONS.has(location)) return null
  const icon = findIcon(ITEMS, words)
  if (!icon) return null
  return { action: { type: "toggleItemLocation", id: icon.id, value: location }, summary: `${icon.alt}: ${location}` }
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

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
  const match = /^!(boss|item)$/.exec(command)
  if (!match) return parseLocationCommand(command, parts)
  const isBoss = match[1] === "boss"

  const last = parts.pop() ?? ""
  if (!/^p?[1-4]$/i.test(last)) return null
  const runner = Number(last.replace(/\D/g, "")) - 1
  if (runner >= runnerCount) return null

  const icon = findIcon(isBoss ? BOSSES : ITEMS, parts)
  if (!icon) return null
  const action: TrackerAction = { type: isBoss ? "toggleBoss" : "toggleItem", runner, id: icon.id }
  return { action, summary: `Toggled ${icon.alt} for player ${runner + 1}` }
}
