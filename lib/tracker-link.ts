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
    const onOpen = () => {
      peer.off("error", onError)
      resolve()
    }
    const onError = (error: { type: string }) => {
      peer.off("open", onOpen)
      peer.destroy()
      reject(
        new Error(
          error.type === "unavailable-id"
            ? "That join code is still held by an earlier session. Wait a minute and try again."
            : error.type === "peer-unavailable"
              ? "No overlay is sharing that code right now."
              : "Could not reach the connection service. Check your internet.",
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

/** Lets trackers join this overlay under `code`. `onLost` fires if sharing stops for good. */
export async function hostTrackers(
  code: string,
  onAction: (action: TrackerAction) => void,
  onCount: (count: number) => void,
  onLost: (message: string) => void,
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
  // The signalling link drops now and then; existing tracker links keep working, new joins need it back.
  // A failed reconnect reports an error and stays disconnected, so keep retrying.
  let retry: number | undefined
  const reconnect = () => {
    if (stopped || peer.destroyed || !peer.disconnected) return
    try {
      peer.reconnect()
    } catch {}
  }
  peer.on("disconnected", reconnect)
  peer.on("error", (error) => {
    if (stopped) return
    if (RECOVERABLE_ERRORS.has(error.type)) {
      window.clearTimeout(retry)
      retry = window.setTimeout(reconnect, RECONNECT_MS)
      return
    }
    // One tracker's link failed; its own close/error handlers drop it
    if (error.type === "webrtc" || error.type === "peer-unavailable") return
    stopped = true
    window.clearTimeout(retry)
    connections.clear()
    peer.destroy()
    onCount(0)
    onLost("Tracker sharing stopped. Press Start sharing to try again.")
  })

  return {
    broadcast(snapshot) {
      latest = snapshot
      for (const conn of connections) if (conn.open) conn.send({ kind: "snapshot", snapshot } satisfies Message)
    },
    stop() {
      stopped = true
      window.clearTimeout(retry)
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
