"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Bricks, STAGE_H, STAGE_W } from "@/components/mockups/parts"

/** Renders the 1456x816 stage scaled down to fit the width of its container. */
export function ScaleBox({ children, label }: { children: ReactNode; label: string }) {
  const outer = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.6)

  useEffect(() => {
    const el = outer.current
    if (!el) return
    const update = () => setScale(el.clientWidth / STAGE_W)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div ref={outer} className="w-full overflow-hidden rounded-md" style={{ height: STAGE_H * scale }}>
      <div
        className="mk-stage"
        role="img"
        aria-label={label}
        style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
      >
        <Bricks />
        {children}
      </div>
    </div>
  )
}
