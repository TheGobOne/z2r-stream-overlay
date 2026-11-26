"use client"

import type { ChatLogEntry, PollView } from "@/lib/use-chat-commands"
import type { ChatStatus } from "@/lib/twitch-chat"

type Props = {
  poll: PollView
  pollSeconds: number
  lockMinutes: number
  onPollSeconds: (value: number) => void
  onLockMinutes: (value: number) => void
  onStartPoll: () => void
  /** Ends the vote now, or ends the lock early. */
  onEndNow: () => void
  channel: string
  on: boolean
  everyone: boolean
  status: ChatStatus
  log: ChatLogEntry[]
  validChannel: boolean
  onChannel: (value: string) => void
  onToggle: (on: boolean) => void
  onEveryone: (value: boolean) => void
}

const STATUS_TEXT: Record<ChatStatus, string> = {
  stopped: "Off",
  connecting: "Connecting",
  connected: "Listening",
  reconnecting: "Reconnecting",
}

const clampNumber = (raw: string, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(raw))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

export function ChatCommandsTools({
  channel,
  on,
  everyone,
  status,
  log,
  validChannel,
  onChannel,
  onToggle,
  onEveryone,
  poll,
  pollSeconds,
  lockMinutes,
  onPollSeconds,
  onLockMinutes,
  onStartPoll,
  onEndNow,
}: Props) {
  return (
    <section className="tools-card" aria-labelledby="tools-chat-title">
      <h2 id="tools-chat-title" className="tools-card-title">
        Chat commands
      </h2>
      <div className="vod-panel-section">
        <label className="vod-label" htmlFor="tools-chat-channel">
          Twitch channel
        </label>
        <input
          id="tools-chat-channel"
          className="vod-input"
          type="text"
          value={channel}
          maxLength={60}
          placeholder="channel name"
          spellCheck={false}
          autoComplete="off"
          onChange={(e) => onChannel(e.target.value)}
        />
        <div className="vod-row">
          <button type="button" className="vod-btn" disabled={!on && !validChannel} onClick={() => onToggle(!on)}>
            {on ? "Stop listening" : "Start listening"}
          </button>
          <span className="tools-hint" role="status">
            {STATUS_TEXT[status]}
          </span>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={everyone} onChange={(e) => onEveryone(e.target.checked)} />
          <span className="tools-hint">Anyone in chat can use commands (uncheck for you and mods only)</span>
        </label>
        <p className="tools-hint">!2p palace 1 &nbsp; !1p hammer &nbsp; !hammer 4 &nbsp; !mk da &nbsp; !listen 1p</p>
        <p className="tools-hint">
          Start with the player, 1p to 4p, then an item, a spell or a palace: !1p hammer, !3p jump, !2p palace 1 or !2p p1 (palace 1 to 7; gp is palace 7). A runner&apos;s name works in place of 1p to 4p, written without spaces, and 3 or more letters of it are enough if only one runner matches: !gob hammer. !hammer 4 sets where an item was found: palace 1 to 6 (3, p3 or palace 3), or RA RU SA MD NA DA NK OK W E MI DM. !fire jump links Fire with shield, jump, life, fairy, reflect, spell or thunder. Boss, item, location and Fire link commands undo when sent again. Names can be short: mk, wol, bird. The same boss, item or location command from several people counts once per 10 seconds, so a crowd doesn't flip it back and forth; you and mods can repeat it right away.
        </p>
        <p className="tools-hint">Sound vote</p>
        <div className="vod-row">
          <button type="button" className="vod-btn" disabled={poll.phase !== "idle"} onClick={onStartPoll}>
            Start vote
          </button>
          <button type="button" className="vod-btn" disabled={poll.phase === "idle"} onClick={onEndNow}>
            {poll.phase === "locked" ? "End lock" : "End vote now"}
          </button>
        </div>
        <label className="vod-label" htmlFor="tools-chat-poll-seconds">
          Vote length (seconds)
        </label>
        <input
          id="tools-chat-poll-seconds"
          className="vod-input"
          type="number"
          min={10}
          max={600}
          value={pollSeconds}
          onChange={(e) => onPollSeconds(clampNumber(e.target.value, 10, 600, pollSeconds))}
        />
        <label className="vod-label" htmlFor="tools-chat-lock-minutes">
          Lock after a vote (minutes)
        </label>
        <input
          id="tools-chat-lock-minutes"
          className="vod-input"
          type="number"
          min={1}
          max={120}
          value={lockMinutes}
          onChange={(e) => onLockMinutes(clampNumber(e.target.value, 1, 120, lockMinutes))}
        />
        <p className="tools-hint">
          Anyone in chat can start a vote with !listen, then vote with !listen 1p. The winner gets the sound and is locked in for the time above. Anyone can set a player's volume with !volume 1p 50. Only you and mods can use !sound 1p.
        </p>
        <p className="tools-hint">While listening, the overlay shows these commands in place of commentary, tracking and race info.</p>
        {log.length > 0 && (
          <ul className="tools-hint" aria-label="Recent commands">
            {log.map((entry) => (
              <li key={entry.id}>
                {entry.user}: {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
