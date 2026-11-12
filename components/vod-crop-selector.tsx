"use client"

import { useEffect, useRef, useState } from "react"
import {
  clamp,
  cropToSelection,
  visibleVideoRect,
  type VideoRect,
  type VodConfig,
  type VodFrameLayout,
  type WindowRect,
} from "@/lib/vod"
import { STAGE_HEIGHT } from "@/lib/quad"

type Point = { x: number; y: number }

type Props = {
  win: WindowRect
  /** Layout of the uncropped video while selecting */
  frame: VodFrameLayout
  onApply: (patch: Pick<VodConfig, "zoom" | "centerX" | "centerY" | "crop">) => void
  onCancel: () => void
  /** The player's real window the crop is saved for, when selecting in an enlarged `win`. */
  target?: WindowRect
  /** Stretch the selection to fill the window; otherwise keep its aspect with black bars. */
  fill?: boolean
  /** Black out everything behind the selector; off when the selector sits over its own preview video. */
  backdrop?: boolean
  /** Height of the area the instructions are positioned within. */
  stageHeight?: number
  /** Put the instructions just below the window, even where the window leaves no room, so they never cover the video. */
  instructionsBelow?: boolean
  /** Keep the selection the same shape as the target window, so the crop fills it with no bars or stretch. */
  lockAspect?: boolean
}

const MIN_SELECTION = 0.02
const DRAG_THRESHOLD_PX = 6
const INSTRUCTIONS_GAP = 6
const INSTRUCTIONS_CLEARANCE = 48

export function VodCropSelector({
  win,
  frame,
  onApply,
  onCancel,
  target,
  fill = true,
  backdrop = true,
  stageHeight = STAGE_HEIGHT,
  instructionsBelow = false,
  lockAspect = false,
}: Props) {
  const cropWin = target ?? win
  const [corner, setCorner] = useState<Point | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const [downAt, setDownAt] = useState<{ x: number; y: number } | null>(null)

  const selectorRef = useRef<HTMLDivElement>(null)

  // The selector may render inside the tools popup, so listen on whichever window owns it
  useEffect(() => {
    const view = selectorRef.current?.ownerDocument.defaultView ?? window
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel()
    view.addEventListener("keydown", onKey)
    return () => view.removeEventListener("keydown", onKey)
  }, [onCancel])

  // Video-space height per unit of width that keeps the selection the target window's shape
  const lockRatio = lockAspect ? (frame.width * cropWin.height) / (cropWin.width * frame.height) : null

  // Moves `b` so the box from `a` has the window's shape. Width or height whichever reaches
  // further drives the size, and the box stays on the video.
  function constrain(a: Point, b: Point): Point {
    if (lockRatio === null) return b
    const dx = b.x - a.x
    const dy = b.y - a.y
    const sx = dx < 0 ? -1 : 1
    const sy = dy < 0 ? -1 : 1
    let ax = Math.max(Math.abs(dx), Math.abs(dy) / lockRatio)
    let ay = ax * lockRatio
    const roomX = sx > 0 ? 1 - a.x : a.x
    const roomY = sy > 0 ? 1 - a.y : a.y
    if (ax > roomX) {
      ax = roomX
      ay = ax * lockRatio
    }
    if (ay > roomY) {
      ay = roomY
      ax = ay / lockRatio
    }
    return { x: a.x + sx * ax, y: a.y + sy * ay }
  }

  function clientToVideoPoint(rect: DOMRect, clientX: number, clientY: number): Point {
    const scale = rect.width / win.width
    const x = (clientX - rect.left) / scale
    const y = (clientY - rect.top) / scale
    return {
      x: clamp((x - frame.left) / frame.width, 0, 1),
      y: clamp((y - frame.top) / frame.height, 0, 1),
    }
  }

  function toVideoPoint(e: React.PointerEvent<HTMLDivElement>): Point {
    return clientToVideoPoint(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY)
  }

  // Once a corner is set, keep following the pointer past the window's edge so the far corner
  // can be reached, and let a click just outside the window finish the crop at the nearest edge.
  useEffect(() => {
    const selector = selectorRef.current
    if (!corner || !selector) return
    const view = selector.ownerDocument.defaultView ?? window
    const onMove = (e: PointerEvent) =>
      setPointer(constrain(corner, clientToVideoPoint(selector.getBoundingClientRect(), e.clientX, e.clientY)))
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || selector.contains(e.target as Node)) return
      finish(corner, clientToVideoPoint(selector.getBoundingClientRect(), e.clientX, e.clientY))
    }
    view.addEventListener("pointermove", onMove)
    view.addEventListener("pointerdown", onDown)
    return () => {
      view.removeEventListener("pointermove", onMove)
      view.removeEventListener("pointerdown", onDown)
    }
  })

  function finish(a: Point, raw: Point) {
    const b = constrain(a, raw)
    const selection = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }
    if (selection.x1 - selection.x0 < MIN_SELECTION || selection.y1 - selection.y0 < MIN_SELECTION) return false
    onApply(cropToSelection(cropWin, selection, fill))
    return true
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    const point = toVideoPoint(e)
    if (corner) {
      if (!finish(corner, point)) setCorner(point)
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    setCorner(point)
    setPointer(point)
    setDownAt({ x: e.clientX, y: e.clientY })
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    const start = downAt
    setDownAt(null)
    if (!start || !corner) return
    const dragged = Math.hypot(e.clientX - start.x, e.clientY - start.y) > DRAG_THRESHOLD_PX
    if (dragged) finish(corner, toVideoPoint(e))
  }

  const selection: VideoRect | null =
    corner && pointer
      ? {
          x0: Math.min(corner.x, pointer.x),
          y0: Math.min(corner.y, pointer.y),
          x1: Math.max(corner.x, pointer.x),
          y1: Math.max(corner.y, pointer.y),
        }
      : null
  const hasArea =
    selection && selection.x1 - selection.x0 >= MIN_SELECTION && selection.y1 - selection.y0 >= MIN_SELECTION
  const result = hasArea ? visibleVideoRect(cropWin, cropToSelection(cropWin, selection, fill)) : null

  const toPx = (r: VideoRect) => ({
    left: frame.left + r.x0 * frame.width,
    top: frame.top + r.y0 * frame.height,
    width: (r.x1 - r.x0) * frame.width,
    height: (r.y1 - r.y0) * frame.height,
  })

  const spaceBelow = stageHeight - (win.top + win.height)
  const instructionsStyle: React.CSSProperties =
    spaceBelow >= INSTRUCTIONS_CLEARANCE || instructionsBelow
      ? { left: win.left + win.width / 2, top: win.top + win.height + INSTRUCTIONS_GAP }
      : win.top >= INSTRUCTIONS_CLEARANCE
        ? { left: win.left + win.width / 2, bottom: stageHeight - win.top + INSTRUCTIONS_GAP }
        : { left: win.left + win.width / 2, bottom: stageHeight - (win.top + win.height) + INSTRUCTIONS_GAP }

  return (
    <>
    {target && backdrop && (
      <div
        className="vod-crop-backdrop"
        aria-hidden="true"
        onContextMenu={(e) => {
          e.preventDefault()
          onCancel()
        }}
      />
    )}
    <div
      ref={selectorRef}
      className="vod-crop-selector"
      style={{ left: win.left, top: win.top, width: win.width, height: win.height }}
      role="application"
      aria-label="Select crop area"
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => corner && setPointer(constrain(corner, toVideoPoint(e)))}
      onPointerUp={handlePointerUp}
      onContextMenu={(e) => {
        e.preventDefault()
        onCancel()
      }}
    >
      <div className="vod-crop-frame" style={toPx({ x0: 0, y0: 0, x1: 1, y1: 1 })} />
      {selection && <div className="vod-crop-selection" style={toPx(selection)} />}
      {result && <div className="vod-crop-result" style={toPx(result)} />}
      {corner && <div className="vod-crop-corner" style={{ left: frame.left + corner.x * frame.width, top: frame.top + corner.y * frame.height }} />}
    </div>
    <p className="vod-crop-instructions" style={instructionsStyle} role="status">
      {corner ? "Click the bottom-right corner" : "Click the top-left corner (or drag a box)"}
      <span>{"Esc or right-click to cancel"}</span>
    </p>
    </>
  )
}
