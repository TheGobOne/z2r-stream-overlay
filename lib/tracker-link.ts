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
export type TrackerAction =
  | { type: "toggleBoss"; runner: number; id: string }
  | { type: "toggleItem"; runner: number; id: string }
  | { type: "cycleBossBadge"; id: string }
  | { type: "clearBossBadge"; id: string }
  | { type: "setItemBadge"; id: string; value: string | null }

type Message = { kind: "snapshot"; snapshot: TrackerSnapshot } | { kind: "action"; action: TrackerAction }

const PEER_PREFIX = "z2r-restream-"
// No 0/O or 1/I, so a code read aloud or off a stream is hard to get wrong
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function newJoinCode() {
  let code = ""
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  for (const b of bytes) code += CODE_ALPHABET[b % CODE_ALPHABET.length]
  return code
}

export function normalizeCode(input: string) {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

async function createPeer(id?: string): Promise<PeerType> {
  const { Peer } = await import("peerjs")
  const peer = id ? new Peer(id) : new Peer()
  await new Promise<void>((resolve, reject) => {
    peer.once("open", () => resolve())
    peer.once("error", (error) => {
      peer.destroy()
      reject(
        new Error(
          error.type === "unavailable-id"
            ? "That join code is already in use. Make a new code."
            : error.type === "peer-unavailable"
              ? "No overlay is sharing that code right now."
              : "Could not reach the connection service. Check your internet.",
        ),
      )
    })
  })
  return peer
}

export type TrackerHost = { broadcast: (snapshot: TrackerSnapshot) => void; stop: () => void }

/** Lets trackers join this overlay under `code`. */
export async function hostTrackers(
  code: string,
  onAction: (action: TrackerAction) => void,
  onCount: (count: number) => void,
): Promise<TrackerHost> {
  const peer = await createPeer(PEER_PREFIX + code)
  const connections = new Set<DataConnection>()
  let latest: TrackerSnapshot | null = null
  let stopped = false

  peer.on("connection", (conn) => {
    conn.on("open", () => {
      connections.add(conn)
      onCount(connections.size)
      if (latest) conn.send({ kind: "snapshot", snapshot: latest } satisfies Message)
    })
    conn.on("data", (data) => {
      const message = data as Message
      if (message?.kind === "action") onAction(message.action)
    })
    const drop = () => {
      connections.delete(conn)
      onCount(connections.size)
    }
    conn.on("close", drop)
    conn.on("error", drop)
  })
  // The signalling link drops now and then; existing tracker links keep working, new joins need it back
  peer.on("disconnected", () => {
    if (!stopped) peer.reconnect()
  })

  return {
    broadcast(snapshot) {
      latest = snapshot
      for (const conn of connections) if (conn.open) conn.send({ kind: "snapshot", snapshot } satisfies Message)
    },
    stop() {
      stopped = true
      connections.clear()
      peer.destroy()
      onCount(0)
    },
  }
}

export type TrackerClient = { send: (action: TrackerAction) => void; stop: () => void }

/** Joins the overlay sharing `code`. */
export async function joinTracker(
  code: string,
  onSnapshot: (snapshot: TrackerSnapshot) => void,
  onClose: () => void,
): Promise<TrackerClient> {
  const peer = await createPeer()
  const conn = peer.connect(PEER_PREFIX + code, { reliable: true })
  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      peer.destroy()
      reject(new Error("No overlay is sharing that code right now."))
    }, 12000)
    conn.once("open", () => {
      window.clearTimeout(timer)
      resolve()
    })
    peer.once("error", (error) => {
      window.clearTimeout(timer)
      peer.destroy()
      reject(new Error(error.type === "peer-unavailable" ? "No overlay is sharing that code right now." : "Could not connect."))
    })
  })
  conn.on("data", (data) => {
    const message = data as Message
    if (message?.kind === "snapshot") onSnapshot(message.snapshot)
  })
  conn.on("close", onClose)
  return {
    send(action) {
      if (conn.open) conn.send({ kind: "action", action } satisfies Message)
    },
    stop() {
      peer.destroy()
    },
  }
}
