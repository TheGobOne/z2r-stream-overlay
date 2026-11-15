"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"

const ON_TOP_KEY = "tracker-tools-on-top"

type TrackerIcon = { id: string; src: string; alt: string }

type Props = {
  bosses: TrackerIcon[]
  items: TrackerIcon[]
  bossBadges: Record<string, number>
  bossBadgeLabels: string[]
  itemBadges: Record<string, string>
  /** Cycles the boss's badge, like right-clicking it on the overlay. */
  onCycleBossBadge: (bossId: string) => void
  onClearBossBadge: (bossId: string) => void
  /** null clears the badge. */
  onSetItemBadge: (itemId: string, value: string | null) => void
  badgeOptions: string[][]
}

/** One master boss and item set for setting badges without a menu appearing on stream. */
export function TrackerTools({
  bosses,
  items,
  bossBadges,
  bossBadgeLabels,
  itemBadges,
  onCycleBossBadge,
  onClearBossBadge,
  onSetItemBadge,
  badgeOptions,
}: Props) {
  const [pickerItem, setPickerItem] = useState<string | null>(null)
  const [popout, setPopout] = useState<Window | null>(null)
  const [onTop, setOnTop] = useState(() => {
    try {
      return localStorage.getItem(ON_TOP_KEY) !== "0"
    } catch {
      return true
    }
  })

  // Opens the panel in its own resizable window. With "Always on top" it uses a Document
  // Picture-in-Picture window (Chrome/Edge), which floats above every other window, OBS included.
  // Without it (or without browser support) it is a plain popup window.
  const openPopout = useCallback(
    async (top: boolean, host: Window = window) => {
      popout?.close()
      let win: Window | null = null
      // The click happened in the tools window, so ask from there: user activation belongs to the window that was clicked
      const pip = (host as unknown as { documentPictureInPicture?: { requestWindow: (o: object) => Promise<Window> } }).documentPictureInPicture
      if (top && pip) {
        try {
          win = await pip.requestWindow({ width: 460, height: 580 })
        } catch {
          win = null
        }
      }
      if (!win) win = host.open("", "tracker-tools-popout", "popup,width=460,height=580")
      if (!win) return
      for (const el of document.querySelectorAll('link[rel="stylesheet"], style')) win.document.head.appendChild(el.cloneNode(true))
      win.document.documentElement.className = document.documentElement.className
      for (const attr of Array.from(document.documentElement.attributes)) {
        if (attr.name.startsWith("data-")) win.document.documentElement.setAttribute(attr.name, attr.value)
      }
      win.document.body.className = document.body.className
      win.document.body.style.margin = "0"
      win.document.body.style.padding = "8px"
      win.document.body.style.background = getComputedStyle(document.body).backgroundColor
      win.document.title = "Bosses and items"
      const opened = win
      opened.addEventListener("pagehide", () => setPopout((cur) => (cur === opened ? null : cur)))
      setPopout(opened)
    },
    [popout],
  )

  useEffect(() => () => popout?.close(), [popout])

  const changeOnTop = (value: boolean, host: Window = window) => {
    setOnTop(value)
    try {
      localStorage.setItem(ON_TOP_KEY, value ? "1" : "0")
    } catch {
      /* preference just isn't remembered */
    }
    // Reopen in the other mode right away, so the checkbox takes effect without extra clicks.
    if (popout) void openPopout(value, host)
  }

  const controls = (inPopout: boolean) => (
    <div className="tools-tracker-controls" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {!inPopout && (
        <button type="button" onClick={(e) => void openPopout(onTop, e.currentTarget.ownerDocument.defaultView ?? window)}>
          Pop out
        </button>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" checked={onTop} onChange={(e) => changeOnTop(e.target.checked, e.currentTarget.ownerDocument.defaultView ?? window)} />
        Always on top
      </label>
      {inPopout && !("documentPictureInPicture" in window) && (
        <span className="tools-hint">This browser cannot float windows, so always on top is unavailable.</span>
      )}
    </div>
  )

  if (popout && !popout.closed) {
    return (
      <>
        <section className="tools-card">
          <h2 className="tools-card-title">Bosses and items</h2>
          <p className="tools-hint">Open in its own window.</p>
          <button type="button" onClick={() => popout.close()}>
            Bring back
          </button>
        </section>
        {createPortal(card(true), popout.document.body)}
      </>
    )
  }
  return card(false)

  function card(inPopout: boolean) {
  return (
    <section className="tools-card" aria-labelledby="tools-tracker-title">
      <h2 id="tools-tracker-title" className="tools-card-title">
        Bosses and items
      </h2>
      {controls(inPopout)}
      <p className="tools-hint">Badges set here show on the overlay. Right-click: set badge. Middle-click: clear badge.</p>

      <div className="tools-tracker-grid" role="group" aria-label="Master boss set">
        {bosses.map((boss) => {
          const badge = bossBadges[boss.id]
          return (
            <button
              key={boss.id}
              type="button"
              className="boss-btn active"
              onContextMenu={(e) => {
                e.preventDefault()
                onCycleBossBadge(boss.id)
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  onClearBossBadge(boss.id)
                }
              }}
              aria-label={`${boss.alt}: right-click to set badge`}
              title={boss.alt}
            >
              <img src={boss.src} alt="" />
              {badge !== undefined && <span className="boss-badge">{bossBadgeLabels[badge]}</span>}
            </button>
          )
        })}
      </div>

      <div className="tools-tracker-grid" role="group" aria-label="Master item set">
        {items.map((item) => {
          const badge = itemBadges[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`item-btn active${pickerItem === item.id ? " tools-picking" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault()
                setPickerItem((current) => (current === item.id ? null : item.id))
              }}
              onAuxClick={(e) => {
                if (e.button === 1) {
                  e.preventDefault()
                  onSetItemBadge(item.id, null)
                }
              }}
              aria-label={`${item.alt}: right-click to set badge`}
              title={item.alt}
            >
              <img src={item.src} alt="" />
              {badge !== undefined && <span className="item-badge num-badge">{badge}</span>}
            </button>
          )
        })}
      </div>

      {pickerItem && (
        <div className="item-context-menu tools-badge-menu" role="group" aria-label="Item badge">
          <p className="tools-hint">Badge for {items.find((i) => i.id === pickerItem)?.alt}</p>
          {badgeOptions.map((row, r) => (
            <div key={r} className="item-context-row">
              {row.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    onSetItemBadge(pickerItem, option)
                    setPickerItem(null)
                  }}
                >
                  {option}
                </button>
              ))}
              {r === badgeOptions.length - 1 && (
                <button
                  type="button"
                  aria-label="Clear badge"
                  title="Clear"
                  onClick={() => {
                    onSetItemBadge(pickerItem, null)
                    setPickerItem(null)
                  }}
                >
                  {"✕"}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
  }
}
