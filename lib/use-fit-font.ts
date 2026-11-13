import { useLayoutEffect, useState, type RefObject } from "react"

let measureCtx: CanvasRenderingContext2D | null = null

/**
 * Font size for a single-line input that stays at `base` until the text would overflow the box,
 * then shrinks just enough to fit (never below `min`). Re-measures when the text or the box size changes.
 */
export function useFitFontSize(
  ref: RefObject<HTMLInputElement | null>,
  text: string,
  { base, min, letterSpacing = 0, enabled = true }: { base: number; min: number; letterSpacing?: number; enabled?: boolean },
) {
  const [size, setSize] = useState(base)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !enabled) {
      setSize(base)
      return
    }
    const fit = () => {
      const style = getComputedStyle(el)
      const avail = el.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight) - 8
      const shown = text || el.placeholder
      measureCtx ??= document.createElement("canvas").getContext("2d")
      if (!measureCtx || avail <= 0 || !shown) return setSize(base)
      measureCtx.font = `${base}px ${style.fontFamily}`
      const width = measureCtx.measureText(shown.toUpperCase()).width + letterSpacing * shown.length
      setSize(width <= avail ? base : Math.max(min, Math.floor((base * avail) / width)))
    }
    fit()
    void document.fonts?.ready.then(fit)
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [ref, text, base, min, letterSpacing, enabled])

  return size
}
