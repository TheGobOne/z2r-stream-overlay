"use client"

import { useState } from "react"

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
  /** One shared item set for marking locations; greyed here only, never on the overlay. */
  markedOff: Set<string>
  onToggleMarked: (itemId: string) => void
  markedBossesOff: Set<string>
  onToggleMarkedBoss: (bossId: string) => void
}

/** One master boss and item set for marking locations and setting badges without a menu appearing on stream. */
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
  markedOff,
  onToggleMarked,
  markedBossesOff,
  onToggleMarkedBoss,
}: Props) {
  const [pickerItem, setPickerItem] = useState<string | null>(null)

  return (
    <section className="tools-card" aria-labelledby="tools-tracker-title">
      <h2 id="tools-tracker-title" className="tools-card-title">
        Bosses and items
      </h2>
      <p className="tools-hint">One master set for marking locations. Not shown on the overlay. Click: toggle. Right-click: set badge. Middle-click: clear badge.</p>

      <div className="tools-tracker-grid" role="group" aria-label="Master boss set">
        {bosses.map((boss) => {
          const off = markedBossesOff.has(boss.id)
          const badge = bossBadges[boss.id]
          return (
            <button
              key={boss.id}
              type="button"
              className={`boss-btn ${off ? "defeated" : "active"}`}
              onClick={() => onToggleMarkedBoss(boss.id)}
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
              aria-label={`${boss.alt}: ${off ? "alive" : "defeated"}`}
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
          const off = markedOff.has(item.id)
          const badge = itemBadges[item.id]
          return (
            <button
              key={item.id}
              type="button"
              className={`item-btn ${off ? "collected" : "active"}${pickerItem === item.id ? " tools-picking" : ""}`}
              onClick={() => onToggleMarked(item.id)}
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
              aria-label={`${item.alt}: ${off ? "not collected" : "collected"}`}
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
