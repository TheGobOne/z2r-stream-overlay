"use client"

import { useEffect, useState } from "react"
import type { PollView } from "@/lib/use-chat-commands"

function clock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`
}

/** The sound vote line: how to start one, the live count, or who is locked in and for how long. */
function PollLine({ poll, players }: { poll: PollView; players: number }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (poll.phase === "idle") return
    const timer = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(timer)
  }, [poll.phase])

  if (poll.phase === "voting") {
    return (
      <div className="chat-help-line chat-help-poll">
        VOTE {clock(poll.endsAt - now)} {poll.counts.slice(0, players).map((c, i) => `${i + 1}P ${c}`).join(" ")}
      </div>
    )
  }
  if (poll.phase === "locked") {
    return (
      <div className="chat-help-line chat-help-poll">
        {poll.winner === null ? "NO VOTES" : `${poll.winner + 1}P HAS SOUND`} {clock(poll.endsAt - now)}
      </div>
    )
  }
  return <div className="chat-help-line chat-help-poll">!listen starts a sound vote</div>
}

/** Shown on the overlay while chat commands are listening, in place of commentary, tracking and race info. */
export function ChatHelp({ className = "", poll, players }: { className?: string; poll: PollView; players: number }) {
  return (
    <div className={`chat-help ${className}`.trim()}>
      <div className="chat-help-col">
        <div className="chat-help-title">CHAT COMMANDS</div>
        <div className="chat-help-line">!boss horsehead 1p</div>
        <div className="chat-help-line">!item hammer 2p</div>
        <div className="chat-help-line">!hammer 4 or rauru</div>
        <div className="chat-help-line">!listen 1p</div>
        <PollLine poll={poll} players={players} />
      </div>
      <div className="chat-help-rule" />
      <div className="chat-help-col chat-help-col-blurb">
        <div className="chat-help-title chat-help-title-blurb">chat2r</div>
        <div className="chat-help-text">chat.....you <em>ARE</em> the tracker!</div>
        <div className="chat-help-text">Anyone can type a command or start a vote on who to listen to.</div>
        <div className="chat-help-text">Item and boss marks can be undone by using the command again.</div>
        <div className="chat-help-text chat-help-warn">Abuse will result in a channel ban.</div>
      </div>
    </div>
  )
}
