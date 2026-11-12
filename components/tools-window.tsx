"use client"

import { useEffect, useLayoutEffect, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"

const TOOLS_WINDOW_NAME = "z2r-overlay-tools"
const TOOLS_WINDOW_FEATURES = "popup,width=880,height=1120"
const COPIED_ATTR = "data-tools-copied"
// A real same-origin page rather than about:blank, so embeds (YouTube) receive a referrer
const TOOLS_PAGE = "/tools.html"

/** Must be called from a click (or key) handler, or the browser blocks the popup. */
export function openToolsWindow(existing: Window | null): Window | null {
  if (existing && !existing.closed) {
    existing.focus()
    return existing
  }
  const win = window.open(TOOLS_PAGE, TOOLS_WINDOW_NAME, TOOLS_WINDOW_FEATURES)
  if (!win) return null
  win.focus()
  return win
}

function isToolsPageReady(win: Window) {
  try {
    return win.location.pathname === TOOLS_PAGE && win.document.readyState === "complete"
  } catch {
    return false
  }
}

function isStyleNode(node: Node) {
  return node instanceof HTMLStyleElement || (node instanceof HTMLLinkElement && node.rel === "stylesheet")
}

/** Renders children into the popup and keeps the overlay's stylesheets mirrored there. */
export function ToolsWindowPortal({ win, children }: { win: Window; children: ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [ready, setReady] = useState(() => isToolsPageReady(win))

  useEffect(() => {
    if (ready) return
    const poll = window.setInterval(() => {
      if (win.closed) window.clearInterval(poll)
      else if (isToolsPageReady(win)) {
        window.clearInterval(poll)
        setReady(true)
      }
    }, 50)
    return () => window.clearInterval(poll)
  }, [win, ready])

  useLayoutEffect(() => {
    if (!ready) return
    const doc = win.document
    doc.title = "Overlay tools"
    doc.head.querySelectorAll(`[${COPIED_ATTR}]`).forEach((node) => node.remove())
    doc.body.replaceChildren()
    doc.body.style.margin = "0"
    doc.body.style.background = "#050505"
    // The overlay's global styles can lock page scrolling; the tools list is taller than the window
    doc.documentElement.style.overflowY = "auto"
    doc.documentElement.style.height = "auto"
    doc.body.style.overflowY = "auto"
    doc.body.style.height = "auto"

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
  }, [win, ready])

  return container ? createPortal(children, container) : null
}
