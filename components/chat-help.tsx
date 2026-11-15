/** Shown on the overlay while chat commands are listening, in place of commentary, tracking and race info. */
export function ChatHelp({ className = "" }: { className?: string }) {
  return (
    <div className={`chat-help ${className}`.trim()}>
      <div className="chat-help-title">CHAT COMMANDS</div>
      <div className="chat-help-line">!boss horsehead p1</div>
      <div className="chat-help-line">!item hammer p2</div>
      <div className="chat-help-line">!hammer 4 or rauru</div>
      <div className="chat-help-line">!sound p1</div>
    </div>
  )
}
