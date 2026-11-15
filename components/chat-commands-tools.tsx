"use client"

import type { ChatLogEntry } from "@/lib/use-chat-commands"
import type { ChatStatus } from "@/lib/twitch-chat"

type Props = {
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

export function ChatCommandsTools({ channel, on, everyone, status, log, validChannel, onChannel, onToggle, onEveryone }: Props) {
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
        <p className="tools-hint">!boss horsehead p2 &nbsp; !item hammer p1 &nbsp; !hammer 4 &nbsp; !mk da &nbsp; !sound p1</p>
        <p className="tools-hint">
          !boss and !item need a player (p1 to p4, or just 1 to 4). !hammer 4 sets where an item was found: palace 1 to 6, or RA RU SA MD NA DA NK OK W E MI DM. Boss, item and location commands undo when sent again. !sound p1 (or !volume p1) puts the sound on that player and mutes the rest; it does not toggle. Names can be short: mk, wol, bird.
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
