"use client"

import { useCallback, useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type ReactNode } from "react"

const STORAGE_KEY = "z2r-booth-layout"

export type BoothPanelDef = { id: string; title: string; node: ReactNode }
type Column = "left" | "right"
type Layout = { left: string[]; right: string[]; collapsed: string[] }

/** Where each panel starts, and the order new panels fall back to. */
const DEFAULT_LAYOUT: Layout = {
  left: ["monitor", "timer"],
  right: ["setup", "series", "racetime", "remote", "trackers", "videos", "clear"],
  collapsed: [],
}

function readLayout(ids: string[]): Layout {
  const known = new Set(ids)
  let saved: Partial<Layout> = {}
  try {
    saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") ?? {}
  } catch {
    saved = {}
  }
  const seen = new Set<string>()
  const clean = (list: unknown, fallback: string[]) =>
    (Array.isArray(list) ? list : fallback).filter((id): id is string => {
      if (typeof id !== "string" || !known.has(id) || seen.has(id)) return false
      seen.add(id)
      return true
    })
  const left = clean(saved.left, DEFAULT_LAYOUT.left)
  const right = clean(saved.right, DEFAULT_LAYOUT.right)
  // Panels added after the layout was saved (or missing from it) go to the end of their default column
  for (const id of ids) {
    if (seen.has(id)) continue
    ;(DEFAULT_LAYOUT.left.includes(id) ? left : right).push(id)
  }
  const collapsed = Array.isArray(saved.collapsed) ? saved.collapsed.filter((id) => known.has(id)) : []
  return { left, right, collapsed }
}

function readDefault(ids: string[]): Layout {
  const known = new Set(ids)
  return {
    left: DEFAULT_LAYOUT.left.filter((id) => known.has(id)),
    right: [...DEFAULT_LAYOUT.right.filter((id) => known.has(id)), ...ids.filter((id) => !DEFAULT_LAYOUT.left.includes(id) && !DEFAULT_LAYOUT.right.includes(id))],
    collapsed: [],
  }
}

function moveTo(layout: Layout, id: string, column: Column, index: number): Layout {
  const left = layout.left.filter((p) => p !== id)
  const right = layout.right.filter((p) => p !== id)
  const target = column === "left" ? left : right
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id)
  return { ...layout, left, right }
}

/**
 * Two columns of panels. Panels drag between and within columns, collapse to their header,
 * and the arrangement is saved in this browser's localStorage (one layout per booth machine).
 * Collapsed panels stay mounted but hidden, so the live preview keeps running.
 */
export function BoothLayout({ panels }: { panels: BoothPanelDef[] }) {
  const ids = panels.map((p) => p.id)
  const idsKey = ids.join("|")
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)
  const [loaded, setLoaded] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<{ column: Column; index: number } | null>(null)
  const columns = useRef<Record<Column, HTMLDivElement | null>>({ left: null, right: null })

  useEffect(() => {
    setLayout(readLayout(ids))
    setLoaded(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey])

  useEffect(() => {
    if (!loaded) return
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout))
    } catch {
      /* private mode or full storage: the layout just won't persist */
    }
  }, [layout, loaded])

  const byId = new Map(panels.map((p) => [p.id, p]))

  const toggle = (id: string) =>
    setLayout((prev) => ({
      ...prev,
      collapsed: prev.collapsed.includes(id) ? prev.collapsed.filter((c) => c !== id) : [...prev.collapsed, id],
    }))

  const insertionIndex = useCallback((column: Column, clientY: number, skip: string | null) => {
    const el = columns.current[column]
    if (!el) return 0
    const items = [...el.querySelectorAll<HTMLElement>(":scope > [data-panel-id]")].filter((n) => n.dataset.panelId !== skip)
    let index = items.length
    for (let i = 0; i < items.length; i++) {
      const box = items[i].getBoundingClientRect()
      if (clientY < box.top + box.height / 2) {
        index = i
        break
      }
    }
    return index
  }, [])

  function onDragOver(column: Column, e: DragEvent) {
    if (!dragId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    const index = insertionIndex(column, e.clientY, dragId)
    setDrop((prev) => (prev && prev.column === column && prev.index === index ? prev : { column, index }))
  }

  function onDrop(column: Column, e: DragEvent) {
    if (!dragId) return
    e.preventDefault()
    const index = insertionIndex(column, e.clientY, dragId)
    setLayout((prev) => moveTo(prev, dragId, column, index))
    endDrag()
  }

  function endDrag() {
    setDragId(null)
    setDrop(null)
  }

  function onKey(id: string, column: Column, e: KeyboardEvent) {
    const list = layout[column]
    const at = list.indexOf(id)
    let next: ((prev: Layout) => Layout) | null = null
    if (e.key === "ArrowUp" && at > 0) next = (prev) => moveTo(prev, id, column, at - 1)
    else if (e.key === "ArrowDown" && at < list.length - 1) next = (prev) => moveTo(prev, id, column, at + 1)
    else if (e.key === "ArrowLeft" && column === "right") next = (prev) => moveTo(prev, id, "left", prev.left.length)
    else if (e.key === "ArrowRight" && column === "left") next = (prev) => moveTo(prev, id, "right", prev.right.length)
    if (!next) return
    setLayout(next)
    e.preventDefault()
    // The panel re-mounts in its new spot; hand focus back to its grip
    const doc = (e.currentTarget as HTMLElement).ownerDocument
    window.requestAnimationFrame(() => {
      doc.querySelector<HTMLElement>(`[data-panel-id="${id}"] .booth-panel-grip`)?.focus()
    })
  }

  function renderColumn(column: Column) {
    const items = layout[column].map((id) => byId.get(id)).filter((p): p is BoothPanelDef => !!p)
    const marker = <div key="drop-marker" className="booth-drop-marker" aria-hidden="true" />
    const out: ReactNode[] = []
    items.forEach((panel, i) => {
      if (drop && drop.column === column && drop.index === i) out.push(marker)
      const collapsed = layout.collapsed.includes(panel.id)
      out.push(
        <section
          key={panel.id}
          data-panel-id={panel.id}
          className={`booth-panel${collapsed ? " collapsed" : ""}${dragId === panel.id ? " dragging" : ""}`}
        >
          <header
            className="booth-panel-head"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = "move"
              e.dataTransfer.setData("text/plain", panel.id)
              const card = (e.currentTarget as HTMLElement).parentElement
              if (card) e.dataTransfer.setDragImage(card, 12, 12)
              setDragId(panel.id)
            }}
            onDragEnd={endDrag}
          >
            <button
              type="button"
              className="booth-panel-grip"
              aria-label={`Move ${panel.title}. Arrow keys move it.`}
              title="Drag to move. Arrow keys also move it."
              onKeyDown={(e) => onKey(panel.id, column, e)}
            >
              ::
            </button>
            <h2 className="booth-panel-title">{panel.title}</h2>
            <button
              type="button"
              className="booth-panel-toggle"
              aria-expanded={!collapsed}
              aria-label={`${collapsed ? "Expand" : "Collapse"} ${panel.title}`}
              onClick={() => toggle(panel.id)}
            >
              {collapsed ? "+" : "-"}
            </button>
          </header>
          <div className="booth-panel-body" hidden={collapsed}>
            {panel.node}
          </div>
        </section>,
      )
    })
    if (drop && drop.column === column && drop.index >= items.length) out.push(marker)
    return out
  }

  return (
    <>
    <div className="booth-toolbar">
      <button
        type="button"
        className="vod-btn"
        onClick={() => setLayout({ ...readDefault(ids) })}
        title="Put every panel back where it started"
      >
        Reset layout
      </button>
    </div>
    <div className="booth-grid">
      {(["left", "right"] as const).map((column) => (
        <div
          key={column}
          ref={(el) => {
            columns.current[column] = el
          }}
          className={`booth-column booth-column-${column}`}
          onDragOver={(e) => onDragOver(column, e)}
          onDrop={(e) => onDrop(column, e)}
        >
          {renderColumn(column)}
        </div>
      ))}
    </div>
    </>
  )
}
