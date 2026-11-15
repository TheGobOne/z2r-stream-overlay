/** Shown on the overlay while chat commands are listening, in place of commentary, tracking and race info. */
export function ChatHelp({ className = "" }: { className?: string }) {
  return (
    <div className={`chat-help ${className}`.trim()}>
      <div className="chat-help-col">
        <div className="chat-help-title">CHAT COMMANDS</div>
        <div className="chat-help-line">!boss horsehead 1p</div>
        <div className="chat-help-line">!item hammer 2p</div>
        <div className="chat-help-line">!hammer 4 or rauru</div>
        <div className="chat-help-line">!sound 1p</div>
      </div>
      <div className="chat-help-rule" />
      <div className="chat-help-col chat-help-col-blurb">
        <div className="chat-help-title chat-help-title-blurb">chat2r</div>
        <div className="chat-help-text">Chat is running the tracker. Anyone can type a command to mark a boss or item for a player. Send it again to undo.</div>
        <div className="chat-help-text chat-help-warn">Abuse will result in a channel ban.</div>
      </div>
    </div>
  )
}
