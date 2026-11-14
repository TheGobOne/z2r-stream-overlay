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
  // The input may mount after this hook first runs (e.g. switching to 2 runners); track it so we re-measure
  const [el, setEl] = useState<HTMLInputElement | null>(null)
  useLayoutEffect(() => {
    if (ref.current !== el) setEl(ref.current)
  })

  useLayoutEffect(() => {
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
      const glyphs = measureCtx.measureText(shown.toUpperCase()).width
      const spacing = letterSpacing * shown.length
      // Letter spacing is fixed px; only the glyphs shrink with the font size
      setSize(glyphs + spacing <= avail ? base : Math.max(min, Math.floor((base * Math.max(0, avail - spacing)) / glyphs)))
    }
    let current = true
    fit()
    void document.fonts?.ready.then(() => {
      if (current) fit()
    })
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => {
      current = false
      observer.disconnect()
    }
  }, [el, text, base, min, letterSpacing, enabled])

  return size
}
