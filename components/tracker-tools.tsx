"use client"

import { useCallback, useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { ItemIcon } from "@/components/item-icon"
import { LINKABLE_ITEM, LINK_PREFIX, LINK_SPELLS, linkedSpellId } from "@/lib/tracker-catalog"

const ON_TOP_KEY = "tracker-tools-on-top"

type TrackerIcon = { id: string; src: string; alt: string }

type Props = {
  bosses: TrackerIcon[]
  items: TrackerIcon[]
  bossBadges: Record<string, number>
  bossBadgeLabels: string[]
  itemBadges: Record<string, string>
  /** Index into bossBadgeLabels; null clears the badge. */
  onSetBossBadge: (bossId: string, index: number | null) => void
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
  onSetBossBadge,
  onClearBossBadge,
  onSetItemBadge,
  badgeOptions,
}: Props) {
  const [pickerItem, setPickerItem] = useState<string | null>(null)
  const [pickerBoss, setPickerBoss] = useState<string | null>(null)
  const [popout, setPopout] = useState<Window | null>(null)
  // Always on top is the default; the checkbox was removed, so this stays true unless a saved "0" exists
  const [onTop] = useState(() => {
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


  const controls = (inPopout: boolean) => (
    <div className="tools-tracker-controls" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
      {!inPopout && (
        <button type="button" className="vod-btn" onClick={(e) => void openPopout(onTop, e.currentTarget.ownerDocument.defaultView ?? window)}>
          Pop out
        </button>
      )}
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
          <button type="button" className="vod-btn" onClick={() => popout.close()}>
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
      <p className="tools-hint">Badges set here show on the overlay. Right-click a boss or item: pick a badge. Middle-click: clear badge.</p>

      <div className="tools-tracker-rows">
      <div className="tools-tracker-row tools-tracker-row-bosses" role="group" aria-label="Master boss set">
        {bosses.map((boss) => {
          const badge = bossBadges[boss.id]
          return (
            <button
              key={boss.id}
              type="button"
              className={`boss-btn active${pickerBoss === boss.id ? " tools-picking" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault()
                setPickerItem(null)
                setPickerBoss((current) => (current === boss.id ? null : boss.id))
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

      {/* Same rows as a player's tracker on the overlay: eight items per row */}
      {Array.from({ length: Math.ceil(items.length / 8) }, (_, r) => items.slice(r * 8, r * 8 + 8)).map((rowItems, r) => (
      <div key={r} className="tools-tracker-row" role="group" aria-label={`Master item set, row ${r + 1}`}>
        {rowItems.map((item) => {
          const badge = itemBadges[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`item-btn active${pickerItem === item.id ? " tools-picking" : ""}`}
              onContextMenu={(e) => {
                e.preventDefault()
                setPickerBoss(null)
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
              <ItemIcon item={item} badge={badge} />
              {badge !== undefined && !linkedSpellId(badge) && <span className="item-badge num-badge">{badge}</span>}
            </button>
          )
        })}
      </div>
      ))}
      </div>

      {pickerBoss && (
        <div className="item-context-menu tools-badge-menu" role="group" aria-label="Palace badge">
          <p className="tools-hint">Badge for {bosses.find((b) => b.id === pickerBoss)?.alt}</p>
          <div className="item-context-row">
            {bossBadgeLabels.map((label, index) => (
              <button
                key={label}
                type="button"
                onClick={() => {
                  onSetBossBadge(pickerBoss, index)
                  setPickerBoss(null)
                }}
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              aria-label="Clear badge"
              title="Clear"
              onClick={() => {
                onClearBossBadge(pickerBoss)
                setPickerBoss(null)
              }}
            >
              {"✕"}
            </button>
          </div>
        </div>
      )}

      {pickerItem && (
        <div className="item-context-menu tools-badge-menu" role="group" aria-label="Item badge">
          <p className="tools-hint">Badge for {items.find((i) => i.id === pickerItem)?.alt}</p>
          {pickerItem === LINKABLE_ITEM && (
            <div className="item-context-row" role="group" aria-label="Link Fire to another spell">
              {LINK_SPELLS.map((id) => {
                const spell = items.find((i) => i.id === id)
                if (!spell) return null
                return (
                  <button
                    key={id}
                    type="button"
                    title={`Link Fire with ${spell.alt}`}
                    aria-label={`Link Fire with ${spell.alt}`}
                    onClick={() => {
                      onSetItemBadge(pickerItem, `${LINK_PREFIX}${id}`)
                      setPickerItem(null)
                    }}
                  >
                    <img src={spell.src} alt="" width={24} height={24} style={{ imageRendering: "pixelated", display: "block" }} />
                  </button>
                )
              })}
            </div>
          )}
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
