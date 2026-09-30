"use client"

import { useEffect, useState } from "react"
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
  onApply: (patch: Pick<VodConfig, "zoom" | "centerX" | "centerY">) => void
  onCancel: () => void
}

const MIN_SELECTION = 0.02
const DRAG_THRESHOLD_PX = 6
const INSTRUCTIONS_GAP = 6
const INSTRUCTIONS_CLEARANCE = 48

export function VodCropSelector({ win, frame, onApply, onCancel }: Props) {
  const [corner, setCorner] = useState<Point | null>(null)
  const [pointer, setPointer] = useState<Point | null>(null)
  const [downAt, setDownAt] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onCancel])

  function toVideoPoint(e: React.PointerEvent<HTMLDivElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect()
    const scale = rect.width / win.width
    const x = (e.clientX - rect.left) / scale
    const y = (e.clientY - rect.top) / scale
    return {
      x: clamp((x - frame.left) / frame.width, 0, 1),
      y: clamp((y - frame.top) / frame.height, 0, 1),
    }
  }

  function finish(a: Point, b: Point) {
    const selection = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) }
    if (selection.x1 - selection.x0 < MIN_SELECTION || selection.y1 - selection.y0 < MIN_SELECTION) return false
    onApply(cropToSelection(win, selection))
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
  const result = hasArea ? visibleVideoRect(win, cropToSelection(win, selection)) : null

  const toPx = (r: VideoRect) => ({
    left: frame.left + r.x0 * frame.width,
    top: frame.top + r.y0 * frame.height,
    width: (r.x1 - r.x0) * frame.width,
    height: (r.y1 - r.y0) * frame.height,
  })

  const spaceBelow = STAGE_HEIGHT - (win.top + win.height)
  const instructionsStyle: React.CSSProperties =
    spaceBelow >= INSTRUCTIONS_CLEARANCE
      ? { left: win.left + win.width / 2, top: win.top + win.height + INSTRUCTIONS_GAP }
      : win.top >= INSTRUCTIONS_CLEARANCE
        ? { left: win.left + win.width / 2, bottom: STAGE_HEIGHT - win.top + INSTRUCTIONS_GAP }
        : { left: win.left + win.width / 2, bottom: STAGE_HEIGHT - (win.top + win.height) + INSTRUCTIONS_GAP }

  return (
    <>
    <div
      className="vod-crop-selector"
      style={{ left: win.left, top: win.top, width: win.width, height: win.height }}
      role="application"
      aria-label="Select crop area"
      onPointerDown={handlePointerDown}
      onPointerMove={(e) => corner && setPointer(toVideoPoint(e))}
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
