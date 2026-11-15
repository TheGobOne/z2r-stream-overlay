import type { DataConnection, Peer as PeerType } from "peerjs"

// Remote trackers connect straight to the overlay's browser (WebRTC through PeerJS's free signalling
// server). The overlay holds the real state; trackers send toggles and get the whole state back.

export type TrackerRunner = {
  name: string
  /** Boss ids still shown greyed on the overlay. */
  bossesGreyed: string[]
  /** Item ids still shown greyed on the overlay. */
  itemsGreyed: string[]
}
export type TrackerSnapshot = {
  runners: TrackerRunner[]
  /** Badges are shared by every runner: boss id to index into bossBadgeLabels, item id to badge text. */
  bossBadges: Record<string, number>
  bossBadgeLabels: string[]
  itemBadges: Record<string, string>
  /** Rows of badge choices offered for an item. */
  badgeOptions: string[][]
}
/** `greyed` (when sent) is the state the helper wants, so repeated or crossing clicks don't undo each other. */
export type TrackerAction =
  | { type: "toggleBoss"; runner: number; id: string; greyed?: boolean }
  | { type: "toggleItem"; runner: number; id: string; greyed?: boolean }
  | { type: "cycleBossBadge"; id: string }
  | { type: "clearBossBadge"; id: string }
  | { type: "setBossBadge"; id: string; value: number | null }
  | { type: "setItemBadge"; id: string; value: string | null }

/** "full": the overlay already has MAX_TRACKERS helpers; the helper should stop retrying. */
type Message = { kind: "snapshot"; snapshot: TrackerSnapshot } | { kind: "action"; action: TrackerAction } | { kind: "full" }

const PEER_PREFIX = "z2r-restream-"
/** Shared by all helpers, so opening more connections can't multiply it. */
const ACTIONS_PER_SECOND = 20
/** Per helper, so one fast helper can't use up everyone else's share. */
const ACTIONS_PER_SECOND_EACH = 8
/** A connection that hasn't opened by then is dropped, so half-made links can't hold slots. */
const CONNECT_TIMEOUT_MS = 15_000
/** After this long of another session holding the code, sharing stops instead of retrying forever. */
const CODE_TAKEN_GIVE_UP_MS = 90_000
/**
 * Plain JSON on both ends: PeerJS's binary serializer reassembles chunked messages with no size limit,
 * so a bad sender could grow the overlay's memory. JSON messages are never chunked (snapshots are ~2 KB).
 */
const SERIALIZATION = "json"
/** More helpers than a race needs; extra connections are refused. */
const MAX_TRACKERS = 8
/** The signalling server normally answers in well under a second. */
const PEER_OPEN_TIMEOUT_MS = 15_000

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === "string")

/** Whatever answers on the code could send anything; only render data with the right shape. */
function isSnapshot(value: unknown): value is TrackerSnapshot {
  if (!value || typeof value !== "object") return false
  const s = value as Record<string, unknown>
  return (
    Array.isArray(s.runners) &&
    s.runners.length <= 4 &&
    s.runners.every(
      (r) => r && typeof r === "object" && typeof r.name === "string" && isStringArray(r.bossesGreyed) && isStringArray(r.itemsGreyed),
    ) &&
    !!s.bossBadges && typeof s.bossBadges === "object" &&
    isStringArray(s.bossBadgeLabels) &&
    Object.values(s.bossBadges).every((n) => Number.isInteger(n) && n >= 0 && n < (s.bossBadgeLabels as string[]).length) &&
    !!s.itemBadges && typeof s.itemBadges === "object" &&
    Object.values(s.itemBadges).every((v) => typeof v === "string") &&
    Array.isArray(s.badgeOptions) &&
    s.badgeOptions.every(isStringArray)
  )
}
// No 0/O or 1/I, so a code read aloud or off a stream is hard to get wrong
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

/** A connection failure with PeerJS's error type, e.g. "unavailable-id" while an old session still holds the code. */
export class TrackerLinkError extends Error {
  constructor(
    message: string,
    readonly type: string,
  ) {
    super(message)
  }
}

export function newJoinCode() {
  let code = ""
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return code
}

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

/**
 * STUN finds a direct path; TURN relays the connection when a firewall or strict NAT blocks that.
 * Set NEXT_PUBLIC_TURN_URLS (comma separated), NEXT_PUBLIC_TURN_USERNAME and NEXT_PUBLIC_TURN_CREDENTIAL
 * to add a relay (Metered, Cloudflare Realtime and Twilio all issue these). Without them only STUN
 * is used, so connections fail behind strict firewalls. No free public TURN server is reliable:
 * Open Relay's hostname now resolves to placeholder addresses.
 */
function iceServers(): RTCIceServer[] {
  const urls = (process.env.NEXT_PUBLIC_TURN_URLS ?? "").split(",").map((u) => u.trim()).filter(Boolean)
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL
  const servers: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }, { urls: "stun:stun1.l.google.com:19302" }]
  if (urls.length > 0 && username && credential) servers.push({ urls, username, credential })
  return servers
}

async function createPeer(id?: string): Promise<PeerType> {
  const { Peer } = await import("peerjs")
  const options = { config: { iceServers: iceServers() } }
  const peer = id ? new Peer(id, options) : new Peer(options)
  await new Promise<void>((resolve, reject) => {
    // Both listeners only cover startup: left attached, a later network blip would destroy a working peer
    // A hung signalling socket would otherwise leave the UI "busy" until the browser gives up.
    // Cleared once settled: a later blip sets peer.open false and must not destroy a working peer.
    const timer = window.setTimeout(() => {
      if (!peer.open && !peer.destroyed) onError({ type: "network" })
    }, PEER_OPEN_TIMEOUT_MS)
    const onOpen = () => {
      window.clearTimeout(timer)
      peer.off("error", onError)
      resolve()
    }
    const onError = (error: { type: string }) => {
      window.clearTimeout(timer)
      peer.off("open", onOpen)
      peer.destroy()
      reject(
        new TrackerLinkError(
          error.type === "unavailable-id"
            ? "That join code is still held by an earlier session. Wait a minute and try again."
            : error.type === "peer-unavailable"
              ? "No overlay is sharing that code right now."
              : "Could not reach the connection service. Check your internet.",
          error.type,
        ),
      )
    }
    peer.once("open", onOpen)
    peer.once("error", onError)
  })
  return peer
}

export type TrackerHost = { broadcast: (snapshot: TrackerSnapshot) => void; stop: () => void }

/** Signalling server trouble: the peer and its open tracker links survive, only new joins wait. */
const RECOVERABLE_ERRORS = new Set(["network", "server-error", "socket-error", "socket-closed", "disconnected", "unavailable-id"])
const RECONNECT_MS = 5000
const MAX_RECONNECT_MS = 60_000

/** Lets trackers join this overlay under `code`. `onLost` fires if sharing stops for good. */
export async function hostTrackers(
  code: string,
  onAction: (action: TrackerAction) => void,
  onCount: (count: number) => void,
  onLost: (message: string) => void,
): Promise<TrackerHost> {
  const peer = await createPeer(PEER_PREFIX + code)
  const connections = new Set<DataConnection>()
  /** Connections still negotiating; they count toward MAX_TRACKERS so a burst of joins can't pass the cap. */
  const pending = new Set<DataConnection>()
  let latest: TrackerSnapshot | null = null
  let stopped = false

  // A helper can't send more than its own share or the shared budget; extra actions are dropped
  let tokens = ACTIONS_PER_SECOND
  let refilledAt = Date.now()
  peer.on("connection", (conn) => {
    if (conn.serialization !== SERIALIZATION) {
      conn.close()
      return
    }
    if (connections.size + pending.size >= MAX_TRACKERS) {
      conn.on("open", () => {
        conn.send({ kind: "full" } satisfies Message)
        window.setTimeout(() => conn.close(), 500)
      })
      window.setTimeout(() => conn.close(), CONNECT_TIMEOUT_MS)
      return
    }
    pending.add(conn)
    const openTimer = window.setTimeout(() => {
      if (pending.delete(conn)) conn.close()
    }, CONNECT_TIMEOUT_MS)
    conn.on("open", () => {
      window.clearTimeout(openTimer)
      if (!pending.delete(conn) || stopped) return
      connections.add(conn)
      onCount(connections.size)
      if (latest) conn.send({ kind: "snapshot", snapshot: latest } satisfies Message)
    })
    let own = ACTIONS_PER_SECOND_EACH
    let ownRefilledAt = Date.now()
    conn.on("data", (data) => {
      const message = data as Message
      if (message?.kind !== "action" || !connections.has(conn)) return
      const now = Date.now()
      tokens = Math.min(ACTIONS_PER_SECOND, tokens + ((now - refilledAt) / 1000) * ACTIONS_PER_SECOND)
      refilledAt = now
      own = Math.min(ACTIONS_PER_SECOND_EACH, own + ((now - ownRefilledAt) / 1000) * ACTIONS_PER_SECOND_EACH)
      ownRefilledAt = now
      if (tokens < 1 || own < 1) return
      tokens -= 1
      own -= 1
      onAction(message.action)
    })
    const drop = () => {
      window.clearTimeout(openTimer)
      pending.delete(conn)
      if (connections.delete(conn)) onCount(connections.size)
    }
    conn.on("close", drop)
    conn.on("error", drop)
  })
  // The signalling link drops now and then; existing tracker links keep working, new joins need it back.
  // Each failed attempt waits longer (5 s doubling to 60 s), so an outage can't turn into a tight loop.
  let retry: number | undefined
  let delay = RECONNECT_MS
  const reconnect = () => {
    if (stopped || peer.destroyed || !peer.disconnected) return
    try {
      peer.reconnect()
    } catch {}
  }
  const scheduleReconnect = () => {
    if (stopped || retry !== undefined) return
    retry = window.setTimeout(() => {
      retry = undefined
      reconnect()
    }, delay)
    delay = Math.min(delay * 2, MAX_RECONNECT_MS)
  }
  /** When the signalling server first said another session holds the code; null while it doesn't. */
  let takenSince: number | null = null
  peer.on("open", () => {
    delay = RECONNECT_MS
    takenSince = null
  })
  peer.on("disconnected", scheduleReconnect)
  const shutDown = () => {
    stopped = true
    window.clearTimeout(retry)
    for (const conn of pending) conn.close()
    pending.clear()
    connections.clear()
    peer.destroy()
    onCount(0)
  }
  peer.on("error", (error) => {
    if (stopped) return
    // After a blip the server can briefly still hold the old socket's id; for longer, another
    // overlay copy (OBS sources share storage) has the code, and new helpers are joining that one
    if (error.type === "unavailable-id") {
      takenSince ??= Date.now()
      if (Date.now() - takenSince > CODE_TAKEN_GIVE_UP_MS) {
        shutDown()
        onLost("Another overlay window took this join code. Close the other copy, then press Start sharing.")
        return
      }
    }
    if (RECOVERABLE_ERRORS.has(error.type)) {
      scheduleReconnect()
      return
    }
    // One tracker's link failed; its own close/error handlers drop it
    if (error.type === "webrtc" || error.type === "peer-unavailable") return
    shutDown()
    onLost("Tracker sharing stopped. Press Start sharing to try again.")
  })

  return {
    broadcast(snapshot) {
      latest = snapshot
      for (const conn of connections) if (conn.open) conn.send({ kind: "snapshot", snapshot } satisfies Message)
    },
    stop: shutDown,
  }
}

export type TrackerClient = { send: (action: TrackerAction) => void; stop: () => void }

/** Joins the overlay sharing `code`. */
export async function joinTracker(
  code: string,
  onSnapshot: (snapshot: TrackerSnapshot) => void,
  /** The link closed; `full` when the overlay refused this helper because it already has the maximum. */
  onClose: (full: boolean) => void,
  /** True while the link is interrupted (ICE "disconnected"); Chrome takes ~30 s before it closes for good. */
  onUnstable?: (unstable: boolean) => void,
): Promise<TrackerClient> {
  const peer = await createPeer()
  const conn = peer.connect(PEER_PREFIX + code, { reliable: true, serialization: SERIALIZATION })
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      peer.destroy()
      // The code is registered (else PeerJS reports peer-unavailable), but the direct link never opened
      reject(new Error("Found the overlay but could not connect to it. A firewall or strict network may be blocking the link."))
    }, 12000)
    const onError = (error: { type: string }) => {
      window.clearTimeout(timer)
      peer.destroy()
      reject(new Error(error.type === "peer-unavailable" ? "No overlay is sharing that code right now." : "Could not connect."))
    }
    conn.once("open", () => {
      window.clearTimeout(timer)
      // Once linked, signalling errors don't matter: the data channel runs peer to peer
      peer.off("error", onError)
      resolve()
    })
    peer.once("error", onError)
  })
  let full = false
  conn.on("data", (data) => {
    const message = data as Message
    if (message?.kind === "snapshot" && isSnapshot(message.snapshot)) onSnapshot(message.snapshot)
    if (message?.kind === "full") full = true
  })
  conn.on("iceStateChanged", (state) => onUnstable?.(state === "disconnected" || state === "failed"))
  conn.on("close", () => {
    // The peer keeps its signalling socket open until destroyed; a retry makes a new one
    peer.destroy()
    onClose(full)
  })
  return {
    send(action) {
      if (conn.open) conn.send({ kind: "action", action } satisfies Message)
    },
    stop() {
      peer.destroy()
    },
  }
}
