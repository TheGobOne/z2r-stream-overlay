import { BOSSES, ITEMS, type TrackerIcon } from "@/lib/tracker-catalog"
import type { TrackerAction } from "@/lib/tracker-link"

/** A tracker action, or an item location (the badge on an item) that clears itself when sent twice. */
export type ChatAction = TrackerAction | { type: "toggleItemLocation"; id: string; value: string } | { type: "toggleBossBadge"; id: string; value: string } | { type: "audio"; runners: number[] } | { type: "volume"; runner: number; value: number } | PollAction
/**
 * Identifies a toggling command (boss, item, item location) by what it changes, so the chat hook can ignore the same
 * one repeated by several viewers. Null for commands that set a value (votes, volume, sound), where repeats are harmless.
 */
export function toggleKey(action: ChatAction): string | null {
  switch (action.type) {
    case "toggleBoss":
    case "toggleItem":
      return `${action.type}:${action.runner}:${action.id}`
    case "toggleItemLocation":
    case "toggleBossBadge":
      return `${action.type}:${action.id}:${action.value}`
    default:
      return null
  }
}

/** Sound polls: the chat hook runs these itself, the page never sees them. */
export type PollAction = { type: "startPoll" } | { type: "vote"; runner: number }
/** What the page runs for a command. */
export type PageAction = Exclude<ChatAction, PollAction>
/** `modOnly` commands are ignored unless the sender is the streamer or a moderator. */
export type ParsedCommand = { action: ChatAction; summary: string; modOnly?: boolean }

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

/** Where a palace is, as chat writes it, mapped to the boss badge text. */
const BOSS_PLACES: Record<string, string> = {
  w: "W",
  west: "W",
  e: "E",
  east: "E",
  mi: "MI",
  maze: "MI",
  mazeisland: "MI",
  dv: "DV",
  deathvalley: "DV",
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
  // `!p3 dv`, `!palace 3 east`: where a palace is, shown as the badge on its boss
  const palace = /^(?:palace|p|gp)([1-7])?$/.exec(command.slice(1))
  if (palace) {
    // `!gp` is palace 7 (the Great Palace), so its words start right away
    const implied = command === "!gp"
    const words = palace[1] || implied ? rest : rest.slice(1)
    const number = implied ? "7" : (palace[1] ?? /^[1-7]$/.exec(rest[0] ?? "")?.[0])
    const badge = BOSS_PLACES[norm(words.join(""))]
    const boss = number ? BOSSES[Number(number) - 1] : null
    if (!boss || !badge) return null
    return { action: { type: "toggleBossBadge", id: boss.id, value: badge }, summary: `${boss.alt}: ${badge}` }
  }
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
  carock: "karock",
  carrock: "karock",
  karrock: "karock",
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

/** The runner whose name is, or contains (3 letters or more), what chat typed. Null when none or several match. */
function findRunner(typed: string, names: string[]): number | null {
  const q = norm(typed)
  if (!q) return null
  const clean = names.map(norm)
  let hits = clean.flatMap((name, i) => (name === q ? [i] : []))
  if (hits.length === 0 && q.length >= 3) hits = clean.flatMap((name, i) => (name.includes(q) ? [i] : []))
  return hits.length === 1 ? hits[0] : null
}

/** Toggles the item, spell or palace boss the words name, for one runner. */
function parseToggle(runner: number, words: string[]): ParsedCommand | null {
  if (words.length === 0) return null
  // "gp" is palace 7, the Great Palace
  const palace = /^(?:palace|p|gp)?([1-7])$|^gp$/.exec(norm(words.join("")))
  const number = palace && (palace[1] ?? "7")
  const icon = number ? BOSSES[Number(number) - 1] : (findIcon(ITEMS, words) ?? findIcon(BOSSES, words))
  if (!icon) return null
  const action: TrackerAction = { type: BOSSES.includes(icon) ? "toggleBoss" : "toggleItem", runner, id: icon.id }
  return { action, summary: `Toggled ${icon.alt} for player ${runner + 1}` }
}

/**
 * `!2p hammer` toggles the item (or spell) for player 2; `!2p palace 1` or `!2p p1` toggles that palace's boss.
 * A runner's name, or part of it, works in place of `2p`. The same command again undoes it.
 * Returns null when the text is not one of these commands, has no valid player, or does not name an item, spell or palace.
 */
export function parseChatCommand(text: string, runnerCount: number, names: string[] = []): ParsedCommand | null {
  const parts = text.trim().split(/\s+/)
  const command = (parts.shift() ?? "").toLowerCase()
  // `!sound 1p`: that player has the sound and everyone else is muted. Only one player can have sound at a time.
  if (command === "!sound") {
    if (parts.length !== 1 || !PLAYER.test(parts[0])) return null
    const runner = Number(parts[0][0]) - 1
    if (runner >= runnerCount) return null
    return { action: { type: "audio", runners: [runner] }, summary: `Sound on player ${runner + 1}`, modOnly: true }
  }
  // `!listen` starts a vote for who the audience hears; `!listen 1p` casts a vote
  if (command === "!listen") {
    if (parts.length === 0) return { action: { type: "startPoll" }, summary: "Started a sound vote" }
    if (parts.length !== 1 || !PLAYER.test(parts[0])) return null
    const runner = Number(parts[0][0]) - 1
    if (runner >= runnerCount) return null
    return { action: { type: "vote", runner }, summary: `Voted for player ${runner + 1}` }
  }
  // `!volume 1p 50`: that player's audio level, 0 to 100
  if (command === "!volume") {
    if (parts.length !== 2 || !PLAYER.test(parts[0]) || !/^\d{1,3}%?$/.test(parts[1])) return null
    const runner = Number(parts[0][0]) - 1
    const percent = Number.parseInt(parts[1], 10)
    if (runner >= runnerCount || percent > 100) return null
    return { action: { type: "volume", runner, value: percent / 100 }, summary: `Player ${runner + 1} volume ${percent}` }
  }
  // `!1p hammer`, `!1p jump`, `!1p palace 1` or `!1p p1`: toggles that item, spell or palace boss for the player
  const player = /^!([1-4]p)$/.exec(command)
  if (player) {
    const runner = Number(player[1][0]) - 1
    return runner < runnerCount ? parseToggle(runner, parts) : null
  }
  // Location commands come first, so a runner name never changes what `!hammer 4` means
  const location = parseLocationCommand(command, parts)
  if (location || !command.startsWith("!")) return location
  const named = findRunner(command.slice(1), names.slice(0, runnerCount))
  return named === null ? null : parseToggle(named, parts)
}
