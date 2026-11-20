"use client"

import { useEffect, useState, type ReactNode } from "react"
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
export function ChatHelp({ className = "", poll, players, view }: { className?: string; poll: PollView; players: number; view?: "commands" | "info" }) {
  // `view` shows one section at a time (3 and 4 player layouts); without it both sit side by side
  return (
    <div className={`chat-help ${className}`.trim()}>
      {view !== "info" && (
        <div className="chat-help-col">
          <div className="chat-help-title">CHAT COMMANDS</div>
          <div className="chat-help-line">!1p palace 1</div>
          <div className="chat-help-line">!2p hammer</div>
          <div className="chat-help-line">!hammer 4 or rauru</div>
          <div className="chat-help-line">!volume 1p 50</div>
          <PollLine poll={poll} players={players} />
        </div>
      )}
      {view === undefined && <div className="chat-help-rule" />}
      {view !== "commands" && (
        <div className="chat-help-col chat-help-col-blurb">
          <div className="chat-help-title chat-help-title-blurb">chat2r</div>
          <div className="chat-help-text">chat is tracking!</div>
          <div className="chat-help-text">Type a command or vote on who to hear.</div>
          <div className="chat-help-text">Use a command again to undo it.</div>
          <div className="chat-help-text chat-help-warn">Abuse means a channel ban.</div>
        </div>
      )}
    </div>
  )
}

/** Slides its content up from the bottom of the nearest positioned parent when `open`, and back down when not. */
export function ChatPopup({ open, className = "", children }: { open: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`chat-popup-clip ${className}`.trim()}>
      <div className="chat-popup" data-open={open || undefined}>
        {children}
      </div>
    </div>
  )
}
