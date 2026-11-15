/** Read-only Twitch chat over the anonymous IRC WebSocket. No login or token: it only listens. */

export type ChatMessage = {
  user: string
  text: string
  /** The streamer or a moderator of the channel. */
  privileged: boolean
}

export type ChatStatus = "connecting" | "connected" | "reconnecting" | "stopped"

const URL = "wss://irc-ws.chat.twitch.tv:443"
const CHANNEL = /^[a-z0-9_]{3,25}$/

export function cleanChannel(raw: string): string {
  const name = raw.trim().replace(/^#/, "").replace(/^https?:\/\/(www\.)?twitch\.tv\//i, "").split(/[/?]/)[0].toLowerCase()
  return CHANNEL.test(name) ? name : ""
}

function parseTags(raw: string): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const part of raw.split(";")) {
    const i = part.indexOf("=")
    if (i > 0) tags[part.slice(0, i)] = part.slice(i + 1)
  }
  return tags
}

/** Parses one IRC line; returns null for anything that is not a chat message. */
export function parseChatLine(line: string): ChatMessage | null {
  let rest = line
  let tags: Record<string, string> = {}
  if (rest.startsWith("@")) {
    const space = rest.indexOf(" ")
    if (space < 0) return null
    tags = parseTags(rest.slice(1, space))
    rest = rest.slice(space + 1)
  }
  const match = /^:([^!\s]+)![^ ]* PRIVMSG #[^ ]+ :(.*)$/.exec(rest)
  if (!match) return null
  const badges = (tags.badges ?? "").split(",")
  const privileged = badges.some((b) => b.startsWith("broadcaster/") || b.startsWith("moderator/"))
  return { user: tags["display-name"] || match[1], text: match[2], privileged }
}

/**
 * Joins a channel's chat and reconnects with backoff until stopped.
 * `onStatus` reports the connection; `onMessage` gets every chat message.
 */
export function joinChat(channel: string, onMessage: (m: ChatMessage) => void, onStatus: (s: ChatStatus) => void): { stop: () => void } {
  let ws: WebSocket | null = null
  let stopped = false
  let retry = 0
  let timer = 0

  const connect = () => {
    if (stopped) return
    onStatus(retry === 0 ? "connecting" : "reconnecting")
    const socket = new WebSocket(URL)
    ws = socket
    socket.onopen = () => {
      socket.send("CAP REQ :twitch.tv/tags")
      socket.send("PASS SCHMOOPIIE")
      socket.send(`NICK justinfan${Math.floor(10000 + Math.random() * 80000)}`)
      socket.send(`JOIN #${channel}`)
    }
    socket.onmessage = (event) => {
      for (const line of String(event.data).split("\r\n")) {
        if (!line) continue
        if (line.startsWith("PING")) {
          socket.send("PONG :tmi.twitch.tv")
          continue
        }
        if (line.includes(" 366 ")) {
          retry = 0
          onStatus("connected")
          continue
        }
        const message = parseChatLine(line)
        if (message) onMessage(message)
      }
    }
    socket.onclose = () => {
      if (ws === socket) ws = null
      if (stopped) return
      retry += 1
      onStatus("reconnecting")
      timer = window.setTimeout(connect, Math.min(30000, 2000 * 2 ** Math.min(retry, 4)))
    }
  }
  connect()

  return {
    stop() {
      stopped = true
      window.clearTimeout(timer)
      onStatus("stopped")
      try {
        ws?.close()
      } catch {}
    },
  }
}
