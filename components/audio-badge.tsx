type Props = {
  playerName: string
  muted: boolean
  /** Left-click: make this runner the only one with audio. Volume is set from the tools window. */
  onSelectAudio: () => void
}

// A pixel music note on an 8x8 grid
const NOTE_PIXELS: [number, number, number, number][] = [
  [3, 0, 4, 1],
  [3, 1, 1, 1],
  [6, 1, 1, 1],
  [3, 2, 1, 1],
  [6, 2, 1, 1],
  [3, 3, 1, 1],
  [6, 3, 1, 1],
  [1, 4, 3, 1],
  [5, 4, 2, 1],
  [0, 5, 7, 1],
  [0, 6, 3, 1],
  [4, 6, 3, 1],
]

/**
 * Shows which runner's audio is on: a lit note beside the name, dim when muted. Left-click switches
 * to this runner; volume is set from the tools window only. It sits outside the video because Twitch
 * refuses script play() while anything covers its iframe.
 */
export function AudioBadge({ playerName, muted, onSelectAudio }: Props) {
  return (
    <button
      type="button"
      className={`vod-audio${muted ? " vod-audio-muted" : ""}`}
      aria-label={muted ? `Switch to ${playerName} audio` : `Listening to ${playerName}`}
      title={muted ? "Click: listen to this runner" : "Listening to this runner"}
      onClick={onSelectAudio}
      onContextMenu={(e) => e.stopPropagation()}
    >
      <svg viewBox="0 0 8 8" width="20" height="20" shapeRendering="crispEdges" aria-hidden="true">
        {NOTE_PIXELS.map(([x, y, w, h], i) => (
          <rect key={i} x={x} y={y} width={w} height={h} fill="currentColor" />
        ))}
      </svg>
    </button>
  )
}
