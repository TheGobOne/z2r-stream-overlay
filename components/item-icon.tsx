import { ITEMS, linkedSpellId, type TrackerIcon } from "@/lib/tracker-catalog"
import "./item-icon.css"

/** An item icon. A linked spell shows Fire on the left and the other spell on the right, both whole and small, with a slash between. */
export function ItemIcon({ item, badge, alt }: { item: TrackerIcon; badge?: string; alt?: string }) {
  const other = ITEMS.find((i) => i.id === linkedSpellId(badge))
  if (!other) return <img src={item.src || "/placeholder.svg"} alt={alt ?? ""} />
  return (
    <span className="item-link">
      <img className="item-link-size" src={item.src} alt="" aria-hidden="true" />
      <span className="item-link-pair">
        <img src={item.src} alt={alt ?? ""} />
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <line x1="17" y1="83" x2="83" y2="17" stroke="#000" strokeWidth="5" vectorEffect="non-scaling-stroke" />
          <line x1="17" y1="83" x2="83" y2="17" stroke="#FFE040" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        </svg>
        <img src={other.src} alt="" />
      </span>
    </span>
  )
}
