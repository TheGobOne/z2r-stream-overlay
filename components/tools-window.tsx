"use client"

import { useLayoutEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

const TOOLS_WINDOW_NAME = "z2r-overlay-tools"
const TOOLS_WINDOW_FEATURES = "popup,width=880,height=980"
const COPIED_ATTR = "data-tools-copied"

/** Must be called from a click (or key) handler, or the browser blocks the popup. */
export function openToolsWindow(existing: Window | null): Window | null {
  if (existing && !existing.closed) {
    existing.focus()
    return existing
  }
  const win = window.open("", TOOLS_WINDOW_NAME, TOOLS_WINDOW_FEATURES)
  if (!win) return null
  // A popup left over from a previous page load keeps its old document; start clean.
  win.document.head.querySelectorAll(`[${COPIED_ATTR}]`).forEach((node) => node.remove())
  win.document.body.replaceChildren()
  win.focus()
  return win
}

function isStyleNode(node: Node) {
  return node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.rel === "stylesheet")
}

/** Renders children into the popup and keeps the overlay's stylesheets mirrored there. */
export function ToolsWindowPortal({ win, children }: { win: Window; children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const doc = win.document
    doc.title = "Overlay tools"
    if (!doc.querySelector("base")) {
      const base = doc.createElement("base")
      base.href = window.location.href
      doc.head.appendChild(base)
    }
    doc.body.style.margin = "0"
    doc.body.style.background = "#050505"

    const syncStyles = () => {
      doc.head.querySelectorAll(`[${COPIED_ATTR}]`).forEach((node) => node.remove())
      document.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement
        clone.setAttribute(COPIED_ATTR, "")
        doc.head.appendChild(clone)
      })
    }
    syncStyles()

    // Re-mirror only when a stylesheet changes (HMR, route styles), not on every text update
    let frame = 0
    const observer = new MutationObserver((mutations) => {
      const touchesStyles = mutations.some(
        (m) =>
          isStyleNode(m.target) ||
          m.target.parentNode instanceof HTMLStyleElement ||
          [...m.addedNodes, ...m.removedNodes].some(isStyleNode),
      )
      if (!touchesStyles) return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(syncStyles)
    })
    observer.observe(document.documentElement, { childList: true, subtree: true, characterData: true })

    const root = doc.createElement("div")
    doc.body.appendChild(root)
    setContainer(root)

    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
      root.remove()
      setContainer(null)
    }
  }, [win])

  return container ? createPortal(children, container) : null
}
