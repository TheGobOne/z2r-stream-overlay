"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { VodPlayer, type VodPlayerHandle } from "@/components/vod-player"
import { PlayerTools } from "@/components/player-tools"
import { SetupForm } from "@/components/setup-form"
import { assignPlace, PlaceBadge, type Placements } from "@/components/place-badge"
import { openToolsWindow, ToolsWindowPortal } from "@/components/tools-window"
import { FourPlayerOverlay, type QuadOverlayHandle } from "@/components/four-player-overlay"
import { QUAD_LAYOUT, TRIO_LAYOUT } from "@/lib/quad"
import { createVodConfig, hasSource, resolveVodLayouts, VOD_WINDOWS, type VodConfig, type VodSide } from "@/lib/vod"

const STATE_STORAGE_KEY = "z2r-overlay-state"
const TIMER_STORAGE_KEY = "z2r-overlay-timer"

const BOSSES = [
  { id: "horsehead",   src: "/icons/horsehead.png",   alt: "Horsehead" },
  { id: "helmethead",  src: "/icons/helmethead.png",  alt: "Helmethead" },
  { id: "rebonack",    src: "/icons/rebonack.png",    alt: "Rebonack" },
  { id: "karock",      src: "/icons/karock.png",      alt: "Karock" },
  { id: "gooma",       src: "/icons/gooma.png",       alt: "Gooma" },
  { id: "barba",       src: "/icons/barba.png",       alt: "Barba" },
  { id: "thunderbird", src: "/icons/thunderbird.png", alt: "Thunderbird" },
]

// Row 1: candle, glove, raft, boots, flute, cross, downstab, upstab
// Row 2: hammer, magickey, trophy, mirror, noteforriverman, wateroflife, water, kid
// Row 3: shield, jump, life, fairy, fire, reflect, spell, thunder
const ITEMS = [
  { id: "candle",          src: "/icons/candle.png",          alt: "Candle" },
  { id: "glove",           src: "/icons/glove.png",           alt: "Glove" },
  { id: "raft",            src: "/icons/raft.png",            alt: "Raft" },
  { id: "boots",           src: "/icons/boots.png",           alt: "Boots" },
  { id: "flute",           src: "/icons/flute.png",           alt: "Flute" },
  { id: "cross",           src: "/icons/cross.png",           alt: "Cross" },
  { id: "downstab",        src: "/icons/downstab.png",        alt: "Downstab" },
  { id: "upstab",          src: "/icons/upstab.png",          alt: "Upstab" },
  { id: "hammer",          src: "/icons/hammer.png",          alt: "Hammer" },
  { id: "magickey",        src: "/icons/magickey.png",        alt: "Magic Key" },
  { id: "trophy",          src: "/icons/trophy.png",          alt: "Trophy" },
  { id: "mirror",          src: "/icons/mirror.png",          alt: "Mirror" },
  { id: "noteforriverman", src: "/icons/bagusletter.png", alt: "Note for Riverman" },
  { id: "wateroflife",     src: "/icons/wateroflife.png",     alt: "Water of Life" },
  { id: "water",           src: "/icons/water.png",           alt: "Water" },
  { id: "kid",             src: "/icons/kid.png",             alt: "Child" },
  { id: "shield",          src: "/icons/shield.png",          alt: "Shield" },
  { id: "jump",            src: "/icons/jump.png",            alt: "Jump" },
  { id: "life",            src: "/icons/life.png",            alt: "Life" },
  { id: "fairy",           src: "/icons/fairy.png",           alt: "Fairy" },
  { id: "fire",            src: "/icons/fire.png",            alt: "Fire" },
  { id: "reflect",         src: "/icons/reflect.png",         alt: "Reflect" },
  { id: "spell",           src: "/icons/spell.png",           alt: "Spell" },
  { id: "thunder",         src: "/icons/thunder.png",         alt: "Thunder" },
]

export default function StreamOverlay() {
  const [leftText, setLeftText] = useState("")
  const [rightText, setRightText] = useState("")
  const [leftFontSize, setLeftFontSize] = useState(18)
  const [rightFontSize, setRightFontSize] = useState(18)
  const [gemCount, setGemCount] = useState<number | null>(null)
  const [gemPopupOpen, setGemPopupOpen] = useState(false)
  const [commentator1, setCommentator1] = useState("")
  const [commentator2, setCommentator2] = useState("")
  const [tracking, setTracking] = useState("")
  const [raceInfo, setRaceInfo] = useState("")

  const [setupOpen, setSetupOpen] = useState(true)
  const [commentatorCount, setCommentatorCount] = useState<1 | 2>(2)
  const [isMaxRando, setIsMaxRando] = useState(false)
  const [draftCommentatorCount, setDraftCommentatorCount] = useState<1 | 2>(2)
  const [draftMaxRando, setDraftMaxRando] = useState(false)
  const [runnerCount, setRunnerCount] = useState<2 | 3 | 4>(2)
  const [draftRunnerCount, setDraftRunnerCount] = useState<2 | 3 | 4>(2)
  const visibleBosses = BOSSES
  const quadRef = useRef<QuadOverlayHandle>(null)

  const [toolsWin, setToolsWin] = useState<Window | null>(null)
  const [popupBlocked, setPopupBlocked] = useState(false)
  const [quadToolsSlot, setQuadToolsSlot] = useState<HTMLElement | null>(null)

  /** Opens (or focuses) the separate tools window; must run inside a click/key handler. */
  function showTools() {
    const win = openToolsWindow(toolsWin)
    setPopupBlocked(!win)
    if (win && win !== toolsWin) setToolsWin(win)
    return win
  }

  useEffect(() => {
    if (!toolsWin) return
    const poll = window.setInterval(() => {
      if (toolsWin.closed) setToolsWin(null)
    }, 500)
    // The tools are rendered by this page, so they'd go dead if the overlay reloads
    const closeWithOverlay = () => toolsWin.close()
    window.addEventListener("pagehide", closeWithOverlay)
    return () => {
      window.clearInterval(poll)
      window.removeEventListener("pagehide", closeWithOverlay)
    }
  }, [toolsWin])

  const [placements, setPlacements] = useState<Placements>(() => Array(4).fill(null))
  const [quadNames, setQuadNames] = useState<string[]>([])

  function applyRunnerCount(n: 2 | 3 | 4) {
    if (n !== runnerCount) {
      setPlacements(Array(4).fill(null))
      setQuadNames([])
    }
    setRunnerCount(n)
    setDraftRunnerCount(n)
  }

  function applyCommentatorCount(n: 1 | 2) {
    setCommentatorCount(n)
    setDraftCommentatorCount(n)
    if (n === 1) setCommentator2("")
  }

  function applyMaxRando(value: boolean) {
    setIsMaxRando(value)
    setDraftMaxRando(value)
  }

  function confirmSetup() {
    applyRunnerCount(draftRunnerCount)
    applyCommentatorCount(draftCommentatorCount)
    applyMaxRando(draftMaxRando)
    if (showTools()) setSetupOpen(false)
  }

  /** Right-clicks that used to reopen setup on the overlay now bring up the private tools window. */
  function reopenSetup(e: React.MouseEvent) {
    e.preventDefault()
    if (showTools()) return
    setDraftCommentatorCount(commentatorCount)
    setDraftMaxRando(isMaxRando)
    setDraftRunnerCount(runnerCount)
    setSetupOpen(true)
  }

  const [vods, setVods] = useState<Record<VodSide, VodConfig>>(() => ({
    left: createVodConfig(),
    right: createVodConfig(),
  }))
  const [toolsSide, setToolsSide] = useState<VodSide>("left")
  const [linkVodsToTimer, setLinkVodsToTimer] = useState(true)
  const leftVodRef = useRef<VodPlayerHandle>(null)
  const rightVodRef = useRef<VodPlayerHandle>(null)
  const vodRefs = { left: leftVodRef, right: rightVodRef }

  function updateVod(side: VodSide, patch: Partial<VodConfig>) {
    setVods((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }))
  }

  function playBothVods() {
    leftVodRef.current?.play()
    rightVodRef.current?.play()
  }

  function pauseBothVods() {
    leftVodRef.current?.pause()
    rightVodRef.current?.pause()
  }

  function openVodPanel(side: VodSide, e: React.MouseEvent) {
    e.preventDefault()
    setToolsSide(side)
    showTools()
  }

  const vodLayouts = resolveVodLayouts(vods)
  const duoLabel = (side: VodSide) =>
    (side === "left" ? leftText : rightText) || (side === "left" ? "Player 1" : "Player 2")

  // Timer state: 0 = stopped/reset, 1 = running, 2 = paused
  const [timerPhase, setTimerPhase] = useState<0 | 1 | 2>(0)
  const [timerMs, setTimerMs] = useState(0)
  const [timerEditOpen, setTimerEditOpen] = useState(false)
  const [timerEditValue, setTimerEditValue] = useState("0:00:00")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartRef = useRef<number>(0)
  const timerAccRef = useRef<number>(0)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (timerPhase === 1) {
      timerStartRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setTimerMs(timerAccRef.current + (Date.now() - timerStartRef.current))
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (timerPhase === 2 && timerStartRef.current) {
        // Fold in the time since the last tick so pausing doesn't drop up to 100ms
        timerAccRef.current += Date.now() - timerStartRef.current
        timerStartRef.current = 0
        setTimerMs(timerAccRef.current)
      }
      if (timerPhase === 0) { timerAccRef.current = 0; timerStartRef.current = 0; setTimerMs(0) }
    }
    saveTimer()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerPhase])

  function saveTimer() {
    if (!hydratedRef.current) return
    try {
      localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({ phase: timerPhase, base: timerAccRef.current, startedAt: timerStartRef.current }),
      )
    } catch {}
  }

  function handleTimerClick() {
    // 0 -> start, 1 -> pause, 2 -> reset
    const next = timerPhase === 0 ? 1 : timerPhase === 1 ? 2 : 0
    setTimerPhase(next)
    if (linkVodsToTimer) {
      if (runnerCount !== 2) {
        if (next === 1) quadRef.current?.playAll()
        else quadRef.current?.pauseAll()
      } else if (next === 1) playBothVods()
      else pauseBothVods()
    }
  }

  function handleTimerRightClick(e: React.MouseEvent) {
    e.preventDefault()
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerPhase(0)
    timerAccRef.current = 0
    setTimerMs(0)
    setTimerEditValue("")
    setTimerEditOpen(true)
  }

  function formatTimer(ms: number): string {
    const negative = ms < 0
    const abs = Math.abs(ms)
    const totalSec = Math.floor(abs / 1000)
    const h = Math.floor(totalSec / 3600)
    const m = Math.floor((totalSec % 3600) / 60)
    const s = totalSec % 60
    return `${negative ? "-" : ""}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
  }

  function applyTimerEdit() {
    const ms = parseTimerInput(timerEditValue)
    if (ms === null) return
    timerAccRef.current = ms
    setTimerMs(ms)
    setTimerEditOpen(false)
    saveTimer()
  }

  /** Parses "h:mm:ss", "m:ss" or plain seconds (optionally negative); null if invalid. */
  function parseTimerInput(raw: string): number | null {
    const value = raw.trim()
    if (!value) return 0
    const negative = value.startsWith("-")
    const parts = value.replace(/^-/, "").split(":")
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
    const ms = parts.reduce((total, part) => total * 60 + Number(part), 0) * 1000
    return negative ? -ms : ms
  }
  const timerEditInvalid = parseTimerInput(timerEditValue) === null

  const [leftDefeated, setLeftDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))
  const [rightDefeated, setRightDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))

  // Boss badge cycling: W -> E -> MI -> DV -> clear
  const BOSS_BADGES = ["W", "E", "MI", "DV"]
  // Badges are mirrored across both players, so one record serves both sides
  const [bossBadges, setBossBadges] = useState<Record<string, number>>({})

  function cycleBadge(id: string) {
    setBossBadges((prev) => {
      const next = { ...prev }
      const current = prev[id]
      if (current === undefined) next[id] = 0
      else if (current >= BOSS_BADGES.length - 1) delete next[id]
      else next[id] = current + 1
      return next
    })
  }
  const [leftCollected, setLeftCollected] = useState<Set<string>>(new Set(ITEMS.map(i => i.id)))
  const [rightCollected, setRightCollected] = useState<Set<string>>(new Set(ITEMS.map(i => i.id)))

  // Item badge menus
  const CODE_OPTIONS = ["RA", "RU", "SA", "MD", "NA", "DA", "NK", "OK"]
  const NUMBER_OPTIONS = ["1", "2", "3", "4", "5", "6"]
  const LETTER_OPTIONS: { label: string; src?: string; clear?: boolean }[] = [
    { label: "W", src: "/overlays/letter-w.png" },
    { label: "E", src: "/overlays/letter-e.png" },
    { label: "MI", src: "/overlays/letter-mi.png" },
    { label: "DM", src: "/overlays/letter-dm.png" },
    { label: "", clear: true },
  ]

  // Badge values keyed by item id, per side
  const [itemBadges, setItemBadges] = useState<Record<string, string>>({})

  type ItemMenu = {
    x: number
    y: number
    side: "left" | "right"
    itemId: string
    type: "number" | "letter"
  } | null
  const [itemMenu, setItemMenu] = useState<ItemMenu>(null)

  function openItemMenu(
    e: React.MouseEvent,
    side: "left" | "right",
    itemId: string,
    type: "number" | "letter",
  ) {
    e.preventDefault()
    setItemMenu({ x: e.clientX, y: e.clientY, side, itemId, type })
  }

  function selectItemBadge(value: string | null) {
    if (!itemMenu) return
    const { itemId } = itemMenu
    setItemBadges((prev) => {
      const next = { ...prev }
      if (value === null) delete next[itemId]
      else next[itemId] = value
      return next
    })
    setItemMenu(null)
  }

  function clearItemBadge(itemId: string) {
    setItemBadges((prev) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    })
  }

  function clearBossBadge(bossId: string) {
    setBossBadges((prev) => {
      const next = { ...prev }
      delete next[bossId]
      return next
    })
  }

  const itemMenuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const menu = itemMenuRef.current
    if (!itemMenu || !menu) return
    const margin = 8
    const { width, height } = menu.getBoundingClientRect()
    const maxLeft = window.innerWidth - width - margin
    const maxTop = window.innerHeight - height - margin
    menu.style.left = `${Math.max(margin, Math.min(itemMenu.x, maxLeft))}px`
    menu.style.top = `${Math.max(margin, Math.min(itemMenu.y, maxTop))}px`
  }, [itemMenu])

  useEffect(() => {
    if (!itemMenu) return
    const close = () => setItemMenu(null)
    window.addEventListener("click", close)
    window.addEventListener("scroll", close, true)
    return () => {
      window.removeEventListener("click", close)
      window.removeEventListener("scroll", close, true)
    }
  }, [itemMenu])

  function renderItemBadge(value: string | undefined) {
    if (value === undefined) return null
    return <span className="item-badge num-badge">{value}</span>
  }

  function calculateFontSize(text: string): number {
    if (text.length <= 6) return 18
    if (text.length <= 10) return 16
    if (text.length <= 14) return 12
    return 9
  }

  function handleLeftTextChange(value: string) {
    setLeftText(value)
    setLeftFontSize(calculateFontSize(value))
  }

  function handleRightTextChange(value: string) {
    setRightText(value)
    setRightFontSize(calculateFontSize(value))
  }

  function toggleLeftBoss(id: string) {
    setLeftDefeated((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRightBoss(id: string) {
    setRightDefeated((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleLeftItem(id: string) {
    setLeftCollected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRightItem(id: string) {
    setRightCollected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Restore what was on screen after a reload (OBS cache refresh, crash, accidental F5)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STATE_STORAGE_KEY) ?? "null")
      if (saved) {
        if (typeof saved.leftText === "string") handleLeftTextChange(saved.leftText)
        if (typeof saved.rightText === "string") handleRightTextChange(saved.rightText)
        if (typeof saved.commentator1 === "string") setCommentator1(saved.commentator1)
        if (typeof saved.commentator2 === "string") setCommentator2(saved.commentator2)
        if (typeof saved.tracking === "string") setTracking(saved.tracking)
        if (typeof saved.raceInfo === "string") setRaceInfo(saved.raceInfo)
        if (typeof saved.gemCount === "number") setGemCount(saved.gemCount)
        if (saved.runnerCount === 2 || saved.runnerCount === 3 || saved.runnerCount === 4) {
          setRunnerCount(saved.runnerCount)
          setDraftRunnerCount(saved.runnerCount)
        }
        if (saved.commentatorCount === 1 || saved.commentatorCount === 2) {
          setCommentatorCount(saved.commentatorCount)
          setDraftCommentatorCount(saved.commentatorCount)
        }
        if (typeof saved.isMaxRando === "boolean") {
          setIsMaxRando(saved.isMaxRando)
          setDraftMaxRando(saved.isMaxRando)
        }
        if (Array.isArray(saved.leftDefeated)) setLeftDefeated(new Set(saved.leftDefeated))
        if (Array.isArray(saved.rightDefeated)) setRightDefeated(new Set(saved.rightDefeated))
        if (Array.isArray(saved.leftCollected)) setLeftCollected(new Set(saved.leftCollected))
        if (Array.isArray(saved.rightCollected)) setRightCollected(new Set(saved.rightCollected))
        if (saved.bossBadges) setBossBadges(saved.bossBadges)
        if (saved.itemBadges) setItemBadges(saved.itemBadges)
        if (Array.isArray(saved.placements)) setPlacements(saved.placements)
        if (saved.vods?.left && saved.vods?.right) {
          setVods({ left: { ...createVodConfig(), ...saved.vods.left }, right: { ...createVodConfig(), ...saved.vods.right } })
        }
        if (typeof saved.linkVodsToTimer === "boolean") setLinkVodsToTimer(saved.linkVodsToTimer)
      }
      const timer = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) ?? "null")
      if (timer && Number.isFinite(timer.base)) {
        const running = timer.phase === 1 && timer.startedAt
        const ms = running ? timer.base + (Date.now() - timer.startedAt) : timer.base
        timerAccRef.current = ms
        setTimerMs(ms)
        if (timer.phase === 1 || timer.phase === 2) setTimerPhase(timer.phase)
      }
    } catch {}
    hydratedRef.current = true
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    try {
      localStorage.setItem(
        STATE_STORAGE_KEY,
        JSON.stringify({
          leftText, rightText, commentator1, commentator2, tracking, raceInfo, gemCount,
          runnerCount, commentatorCount, isMaxRando,
          leftDefeated: [...leftDefeated], rightDefeated: [...rightDefeated],
          leftCollected: [...leftCollected], rightCollected: [...rightCollected],
          bossBadges, itemBadges, placements, vods, linkVodsToTimer,
        }),
      )
    } catch {}
  }, [
    hydrated, leftText, rightText, commentator1, commentator2, tracking, raceInfo, gemCount,
    runnerCount, commentatorCount, isMaxRando, leftDefeated, rightDefeated, leftCollected, rightCollected,
    bossBadges, itemBadges, placements, vods, linkVodsToTimer,
  ])

  // Shrink the fixed 1456x816 stage to fit small windows (OBS sources at full size are untouched)
  const [stageScale, setStageScale] = useState(1)
  useEffect(() => {
    const fit = () => setStageScale(Math.min(1, window.innerWidth / 1456, window.innerHeight / 816))
    fit()
    window.addEventListener("resize", fit)
    return () => window.removeEventListener("resize", fit)
  }, [])

  const setupBoxRef = useRef<HTMLDivElement>(null)
  function handleSetupKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") return confirmSetup()
    if (e.key === "Escape") return setSetupOpen(false)
    if (e.key !== "Tab") return
    const focusable = setupBoxRef.current?.querySelectorAll<HTMLElement>("button, input, select, textarea, [tabindex]:not([tabindex='-1'])")
    if (!focusable?.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
  }

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'ZeldaII';
          src: url('/fonts/ZELDA-II-THE-ADVENTURE-OF-LINK.TTF') format('truetype');
          font-weight: normal;
          font-style: normal;
        }

        html, body {
          margin: 0;
          padding: 0;
          background: transparent;
          width: 100%;
          height: 100%;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .overlay-wrapper {
          position: relative;
          width: 1456px;
          height: 816px;
          flex-shrink: 0;
          background: transparent;
        }

        .overlay-bg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          pointer-events: none;
          user-select: none;
          display: block;
          mix-blend-mode: screen;
          /* Hide the art's tall name frames above the brick row; the brick-height boxes below replace them */
          clip-path: path(evenodd, 'M0 0H1456V816H0Z M37 508H330V544H37Z M1125 508H1418V544H1125Z');
        }

        .text-box-left,
        .text-box-right {
          position: absolute;
          top: 544px;
          width: 288px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #000;
          box-shadow:
            inset 0 0 0 1px #fff,
            inset 0 0 0 4px #2038ef,
            inset 0 0 0 5px #fff;
        }

        .text-box-left::before,
        .text-box-right::before {
          content: "";
          position: absolute;
          inset: 1px;
          pointer-events: none;
          background:
            linear-gradient(#db2800, #db2800) left top / 5px 5px no-repeat,
            linear-gradient(#db2800, #db2800) right top / 5px 5px no-repeat,
            linear-gradient(#db2800, #db2800) left bottom / 5px 5px no-repeat,
            linear-gradient(#db2800, #db2800) right bottom / 5px 5px no-repeat;
        }

        .text-box-left {
          left: 38px;
        }

        .text-box-right {
          right: 39px;
        }

        .text-box-left .zelda-input,
        .text-box-right .zelda-input {
          line-height: 36px;
          top: -4px;
        }

        .zelda-input {
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #7ef5ff;
          font-family: 'ZeldaII', monospace;
          font-size: var(--zelda-font-size, 20px);
          text-align: center;
          padding: 0 6px;
          caret-color: #7ef5ff;
          letter-spacing: 2px;
          box-sizing: border-box;
          text-transform: uppercase;
          line-height: 62px;
          position: relative;
          top: -5px;
          transition: font-size 0.1s ease;
        }

        .zelda-input::placeholder {
          color: rgba(126, 245, 255, 0.25);
          font-family: 'ZeldaII', monospace;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .zelda-input:focus {
          color: #7ef5ff;
        }

        /* Boss tracker row — left black bottom section */
        .boss-row {
          position: absolute;
          top: 595px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        /* Boss tracker row — right black bottom section */
        .boss-row-right {
          position: absolute;
          top: 595px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .boss-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: opacity 0.15s ease, filter 0.15s ease;
        }

        .boss-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          font-family: 'ZeldaII', monospace;
          font-size: 13.5px;
          color: #ffd700;
          line-height: 1;
          pointer-events: none;
          filter: drop-shadow(-1px 0 0 #000) drop-shadow(1px 0 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 1px 0 #000);
          z-index: 2;
        }

        .boss-btn img {
          width: 44px;
          height: 44px;
          image-rendering: pixelated;
          display: block;
        }

        .boss-btn.active img {
          opacity: 1;
          filter: none;
        }

        .boss-btn.defeated img {
          opacity: 0.6;
          filter: grayscale(100%);
        }

        /* Item tracker rows — left black bottom section */
        .item-row-1 {
          position: absolute;
          top: 645px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-2 {
          position: absolute;
          top: 695px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-3 {
          position: absolute;
          top: 745px;
          left: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        /* Item tracker rows — right black bottom section */
        .item-row-1-right {
          position: absolute;
          top: 645px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-2-right {
          position: absolute;
          top: 695px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-row-3-right {
          position: absolute;
          top: 745px;
          right: 39px;
          width: 500px;
          display: flex;
          align-items: center;
          justify-content: space-evenly;
          padding: 0;
          box-sizing: border-box;
        }

        .item-btn {
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          position: relative;
          transition: opacity 0.15s ease, filter 0.15s ease;
        }

        .item-badge {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          image-rendering: pixelated;
          pointer-events: none;
          z-index: 2;
          filter: drop-shadow(-1px 0 0 #000) drop-shadow(1px 0 0 #000) drop-shadow(0 -1px 0 #000) drop-shadow(0 1px 0 #000);
        }

        .item-badge.img-badge {
          width: 18px;
          height: 18px;
        }

        .item-badge.num-badge {
          font-family: 'ZeldaII', monospace;
          font-size: 13.5px;
          color: #ffd700;
          line-height: 1;
        }

        .item-context-menu {
          position: fixed;
          z-index: 2000;
          background: #0a0a0a;
          border: 2px solid #2ec4b6;
          display: flex;
          flex-direction: column;
          align-items: stretch;
          padding: 4px;
          gap: 2px;
        }

        .item-context-row {
          display: flex;
          flex-direction: row;
          align-items: center;
          justify-content: center;
          gap: 2px;
        }

        .item-context-menu .clear-x {
          font-family: 'ZeldaII', monospace;
          font-size: 14px;
          line-height: 1;
        }

        .item-context-row button {
          color: #ffd700;
          text-shadow:
            -1px 0 0 #000, 1px 0 0 #000, 0 -1px 0 #000, 0 1px 0 #000;
        }

        .item-context-menu button {
          background: transparent;
          border: none;
          color: #ffd700;
          font-family: 'ZeldaII', monospace;
          font-size: 14px;
          letter-spacing: 1px;
          padding: 6px 10px;
          cursor: pointer;
          text-align: center;
          min-width: 32px;
          min-height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.1s ease, color 0.1s ease;
        }

        .item-context-menu button:hover {
          background: #2ec4b6;
          color: #000000;
        }

        .item-context-menu button img {
          width: 22px;
          height: 22px;
          image-rendering: pixelated;
          display: block;
        }

        .item-btn img {
          width: 44px;
          height: 44px;
          image-rendering: pixelated;
          display: block;
        }

        .item-btn.active img {
          opacity: 1;
          filter: none;
        }

        .item-btn.collected img {
          opacity: 0.6;
          filter: grayscale(100%);
        }

        .gem-image {
          position: absolute;
          top: 195px;
          left: 50%;
          transform: translateX(-50%);
          pointer-events: auto;
          user-select: none;
          display: block;
          image-rendering: pixelated;
          width: auto;
          height: auto;
          filter: drop-shadow(-4px 0 0 #000) drop-shadow(4px 0 0 #000) drop-shadow(0 -4px 0 #000) drop-shadow(0 4px 0 #000);
          cursor: pointer;
          z-index: 5;
        }

        .gem-count {
          position: absolute;
          top: 330px;
          left: 50%;
          transform: translateX(calc(-50% + 5px));
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 36px;
          letter-spacing: 4px;
          pointer-events: none;
          user-select: none;
          filter: drop-shadow(-4px 0 0 #000) drop-shadow(4px 0 0 #000) drop-shadow(0 -4px 0 #000) drop-shadow(0 4px 0 #000);
          z-index: 5;
        }

        .gem-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .gem-modal-box {
          background: #0a0a0a;
          border: 3px solid #2ec4b6;
          padding: 32px 40px;
          text-align: center;
          font-family: 'ZeldaII', monospace;
          color: #ffffff;
          min-width: 320px;
        }

        .gem-modal-title {
          font-size: 16px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #7ef5ff;
          margin-bottom: 28px;
        }

        .gem-modal-options {
          display: flex;
          gap: 10px;
          justify-content: center;
          flex-wrap: wrap;
        }

        .gem-modal-opt {
          background: #0a0a0a;
          border: 2px solid #2ec4b6;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 18px;
          width: 48px;
          height: 48px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .gem-modal-opt:hover,
        .gem-modal-opt.selected {
          background: #2ec4b6;
          color: #000000;
        }

        /* Transparent overlays for top black boxes */
        .transparent-overlay-left {
          position: absolute;
          top: 0;
          left: 0;
          width: 408px;
          height: 516px;
          background: rgba(0, 0, 0, 0);
          pointer-events: none;
          z-index: 10;
        }

        .transparent-overlay-right {
          position: absolute;
          top: 0;
          right: 0;
          width: 408px;
          height: 516px;
          background: rgba(0, 0, 0, 0);
          pointer-events: none;
          z-index: 10;
        }

        .center-panel-hitbox {
          position: absolute;
          top: 584px;
          left: 581px;
          width: 294px;
          height: 214px;
        }

        .commentary-title {
          position: absolute;
          top: 592px;
          left: 50%;
          transform: translateX(-50%) scale(1.5);
          font-family: 'ZeldaII', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: #ffd700;
          text-decoration: underline;
          text-transform: uppercase;
          pointer-events: none;
          user-select: none;
          transform-origin: center;
        }

        .commentary-container {
          position: absolute;
          top: 607px;
          left: 50%;
          transform: translateX(-50%) scale(1.5);
          width: 140px;
          height: 48px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 4px;
          transform-origin: top center;
        }

        .commentary-input {
          width: 100%;
          height: 20px;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 10px;
          text-align: center;
          padding: 2px;
          caret-color: #7ef5ff;
          letter-spacing: 0.5px;
          box-sizing: border-box;
          text-transform: uppercase;
          transition: border-color 0.15s ease;
        }

        .commentary-input:focus {
          border-color: #7ef5ff;
          color: #7ef5ff;
        }

        .commentary-input::placeholder {
          color: rgba(126, 245, 255, 0.25);
        }

        .tracking-title {
          position: absolute;
          top: 694px;
          left: 50%;
          transform: translateX(-50%) scale(1.5);
          font-family: 'ZeldaII', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: #ffd700;
          text-decoration: underline;
          text-transform: uppercase;
          pointer-events: none;
          user-select: none;
          transform-origin: center;
        }

        .tracking-container {
          position: absolute;
          top: 712px;
          left: 50%;
          transform: translateX(-50%) scale(1.5);
          width: 140px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          transform-origin: top center;
        }

        .tracking-input {
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 10px;
          text-align: center;
          padding: 2px;
          caret-color: #7ef5ff;
          letter-spacing: 0.5px;
          box-sizing: border-box;
          text-transform: uppercase;
          transition: border-color 0.15s ease;
        }

        .tracking-input:focus {
          border-color: #7ef5ff;
          color: #7ef5ff;
        }

        .tracking-input::placeholder {
          color: rgba(126, 245, 255, 0.25);
        }

        .timer-display {
          position: absolute;
          top: 753px;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'ZeldaII', monospace;
          font-size: 21px;
          letter-spacing: 2px;
          color: #ffffff;
          cursor: pointer;
          user-select: none;
          transform-origin: center;
          filter: drop-shadow(-2px 0 0 #000) drop-shadow(2px 0 0 #000) drop-shadow(0 -2px 0 #000) drop-shadow(0 2px 0 #000);
          z-index: 5;
        }

        .timer-display.running {
          color: #ffffff;
        }

        .timer-display.paused {
          color: #ffcc00;
        }

        .timer-edit-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.75);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .timer-edit-box {
          background: #0a0a0a;
          border: 3px solid #2ec4b6;
          padding: 32px 40px;
          text-align: center;
          font-family: 'ZeldaII', monospace;
          color: #ffffff;
          min-width: 280px;
        }

        .timer-edit-title {
          font-size: 13px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #7ef5ff;
          margin-bottom: 20px;
        }

        .timer-edit-input {
          background: transparent;
          border: 2px solid #2ec4b6;
          outline: none;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 20px;
          text-align: center;
          padding: 8px 12px;
          caret-color: #7ef5ff;
          letter-spacing: 3px;
          width: 100%;
          box-sizing: border-box;
          margin-bottom: 20px;
        }

        .timer-edit-btn {
          background: #0a0a0a;
          border: 2px solid #2ec4b6;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 13px;
          letter-spacing: 2px;
          text-transform: uppercase;
          padding: 10px 24px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .timer-edit-btn:hover {
          background: #2ec4b6;
          color: #000000;
        }

        .setup-section {
          margin-bottom: 28px;
        }

        .setup-section .gem-modal-title {
          margin-bottom: 16px;
        }

        .setup-checkbox {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          cursor: pointer;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #ffffff;
        }

        .setup-checkbox input {
          appearance: none;
          width: 24px;
          height: 24px;
          border: 2px solid #2ec4b6;
          background: #0a0a0a;
          cursor: pointer;
          display: grid;
          place-content: center;
          margin: 0;
        }

        .setup-checkbox input:checked {
          background: #2ec4b6;
        }

        .setup-checkbox input:checked::after {
          content: "";
          width: 10px;
          height: 10px;
          background: #000000;
        }

        .setup-checkbox input:focus-visible {
          outline: 2px solid #ffd700;
          outline-offset: 2px;
        }

        .setup-places {
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .setup-place-row {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .setup-place-label {
          width: 120px;
          flex-shrink: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          font-size: 12px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #ffffff;
        }

        .setup-place-options {
          display: flex;
          gap: 6px;
        }

        .setup-place-opt {
          min-width: 44px;
          height: 32px;
          padding: 0 8px;
          background: #0a0a0a;
          border: 2px solid #2ec4b6;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 11px;
          cursor: pointer;
        }

        .setup-place-opt:hover,
        .setup-place-opt.selected {
          background: #2ec4b6;
          color: #000000;
        }

        .setup-place-opt-1.selected { background: #f8b800; border-color: #f8b800; }
        .setup-place-opt-2.selected { background: #bcbcbc; border-color: #bcbcbc; }
        .setup-place-opt-3.selected { background: #e45c10; border-color: #e45c10; }
        .setup-place-opt-4.selected { background: #3050f8; border-color: #3050f8; color: #ffffff; }
        .setup-place-opt-dnf.selected { background: #d01818; border-color: #d01818; color: #ffffff; }

        .setup-place-opt:focus-visible {
          outline: 2px solid #ffd700;
          outline-offset: 2px;
        }

        .place-badge {
          position: absolute;
          transform: translate(-50%, calc(-100% - 10px));
          z-index: 20;
          padding: 2px 8px 5px;
          font-family: 'ZeldaII', monospace;
          font-size: 14px;
          line-height: 1;
          color: #000000;
          pointer-events: none;
          box-shadow: 0 0 0 2px #000000;
        }

        .place-badge-1 { background: #f8b800; }
        .place-badge-2 { background: #bcbcbc; }
        .place-badge-3 { background: #e45c10; }
        .place-badge-4 { background: #3050f8; color: #ffffff; }
        .place-badge-dnf { background: #d01818; color: #ffffff; }

        .place-badge-1 { --glow: 248, 184, 0; }
        .place-badge-2 { --glow: 188, 188, 188; }
        .place-badge-3 { --glow: 228, 92, 16; }
        .place-badge-4 { --glow: 48, 80, 248; }
        .place-badge-dnf { --glow: 208, 24, 24; }

        /* 4-player: 33% larger than the base badge, pinned inside the top edge, with a coloured glow */
        .place-badge-top {
          transform: translate(-50%, 13px);
          padding: 3px 11px 7px;
          font-size: 18.6px;
          box-shadow:
            0 0 0 3px #000000,
            0 0 14px 5px rgba(var(--glow), 0.85),
            0 0 34px 12px rgba(var(--glow), 0.45);
        }

        .setup-hint {
          margin: 0 0 24px;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #7ef5ff;
          line-height: 1.6;
        }

        .vod-window {
          position: absolute;
          overflow: hidden;
          background: #000000;
          /* Twitch pauses embeds that are covered by any other element (even empty ones like
             .transparent-overlay-* and .vod-hitbox), so the video sits above everything that
             overlaps it. The per-side z-index is set inline by VodPlayer. */
          z-index: 13;
        }

        .vod-frame {
          position: absolute;
        }

        .vod-crop-mask {
          position: absolute;
          box-shadow: 0 0 0 4000px #000000;
          pointer-events: none;
        }

        .vod-hitbox {
          position: absolute;
          z-index: 12;
        }

        .vod-audio {
          position: absolute;
          right: 6px;
          bottom: 6px;
          z-index: 2;
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 6px;
        }

        .vod-audio-right {
          right: auto;
          left: 6px;
          align-items: flex-start;
        }

        .vod-audio-badge {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: #ffffff;
  color: #000000;
  cursor: pointer;
  }

  .vod-audio-badge:focus-visible {
  outline: 2px solid #ffd700;
  outline-offset: 2px;
  }

  .vod-volume-pop {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border: 2px solid #20c0b0;
  border-radius: 6px;
  background: #0a0a0a;
  color: #ffffff;
  font-family: var(--font-pixel, monospace);
  font-size: 11px;
  }

  .vod-volume-pop input[type="range"] {
  width: 120px;
  accent-color: #20c0b0;
  cursor: pointer;
  }

  .vod-volume-value {
  min-width: 3ch;
  text-align: right;
  }

  .vod-audio-badge svg {
  width: 24px;
  height: 24px;
  }

  .vod-audio-badge-muted::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 30px;
  background: #000000;
  box-shadow: 0 0 0 1.5px #ffffff;
  transform: translate(-50%, -50%) rotate(45deg);
  }

  .vod-audio-badge-muted {
  opacity: 0;
  transition: opacity 120ms ease;
  }

  .vod-window:hover .vod-audio-badge-muted,
  .vod-audio:focus-within .vod-audio-badge-muted,
  .vod-audio-badge-muted[aria-expanded="true"] {
  opacity: 1;
  }

        .vod-crop-backdrop {
  position: absolute;
  inset: 0;
  z-index: 901;
  background: #000000;
}

        body:has(.vod-crop-backdrop) .vod-audio {
  display: none;
}

        .vod-crop-selector {
  position: absolute;
  z-index: 903;
  overflow: hidden;
  cursor: crosshair;
  touch-action: none;
  user-select: none;
  outline: 2px dashed #ffd700;
  outline-offset: -2px;
  }
  
  .vod-crop-frame, .vod-crop-selection, .vod-crop-result, .vod-crop-corner {
  position: absolute;
  pointer-events: none;
  box-sizing: border-box;
  }
  
  .vod-crop-frame {
  outline: 1px solid rgba(255, 255, 255, 0.35);
  }
  
  .vod-crop-selection {
  border: 2px solid #ffd700;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.55);
  }
  
  .vod-crop-result {
  border: 1px dashed #ffffff;
  }
  
  .vod-crop-corner {
  width: 10px;
  height: 10px;
  margin: -5px 0 0 -5px;
  background: #ffd700;
  border-radius: 50%;
  }
  
  .vod-crop-instructions {
  position: absolute;
  z-index: 904;
  transform: translateX(-50%);
  margin: 0;
  padding: 6px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.85);
  border: 1px solid #ffd700;
  color: #ffffff;
  font-size: 11px;
  letter-spacing: 1px;
  white-space: nowrap;
  pointer-events: none;
  }
  
  .vod-crop-instructions span {
  color: #8a9a9a;
  font-size: 9px;
  }

        .vod-panel {
          position: absolute;
          z-index: 900;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 12px;
          padding: 18px 22px;
          background: #0a0a0a;
          border: 3px solid #2ec4b6;
          font-family: 'ZeldaII', monospace;
          color: #ffffff;
          overflow-y: auto;
        }

        .vod-panel.vod-panel-inline {
          position: static;
          border: 2px solid #2ec4b6;
          overflow: visible;
        }

        .tools {
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 20px;
          min-height: 100vh;
          padding: 24px;
          background: #050505;
          font-family: 'ZeldaII', monospace;
          color: #ffffff;
        }

        .tools-header { display: flex; flex-direction: column; gap: 6px; }
        .tools-heading { margin: 0; font-size: 18px; color: #2ec4b6; letter-spacing: 1px; }
        .tools-subheading { margin: 0; font-size: 9px; color: #8a9a9a; line-height: 1.6; }

        .tools-card {
          display: flex;
          flex-direction: column;
          gap: 14px;
          padding: 18px;
          background: #0a0a0a;
          border: 2px solid #1d3b38;
        }

        .tools-card-title { margin: 0; font-size: 12px; color: #2ec4b6; text-transform: uppercase; }

        .tools .setup-section { display: flex; flex-direction: column; gap: 8px; }
        .tools .setup-columns { display: flex; flex-wrap: wrap; align-items: flex-start; gap: 20px; }
        .tools .setup-column { display: flex; flex-direction: column; gap: 14px; }
        .tools .setup-columns > .setup-column:last-child:not(:first-child) { flex: 1; min-width: 0; }
        .tools .setup-columns .setup-section { margin-bottom: 0; }
  .tools .setup-place-row { gap: 12px; }
  .tools .setup-place-label { width: auto; flex: 1; min-width: 0; font-size: 11px; letter-spacing: 1px; }
  .tools .setup-place-options { gap: 6px; flex-shrink: 0; }
  .tools .setup-place-opt { min-width: 44px; height: 32px; padding: 0 8px; font-size: 11px; }
  .tools .setup-place-opt:first-child { min-width: 32px; }
        .tools .gem-modal-title { margin: 0; font-size: 10px; }
        .tools .gem-modal-options { justify-content: flex-start; }

        .tools-tabs { display: flex; flex-wrap: wrap; gap: 6px; }

        .tools-tab {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: transparent;
          border: 2px solid #2a2a2a;
          color: #8a9a9a;
          font-family: inherit;
          font-size: 10px;
          cursor: pointer;
        }

        .tools-tab:hover { color: #ffffff; border-color: #3a3a3a; }
        .tools-tab[aria-selected="true"] { color: #ffffff; border-color: #2ec4b6; }
        .tools-tab:focus-visible { outline: 2px solid #2ec4b6; outline-offset: 2px; }
        .tools-tab-dot { width: 6px; height: 6px; background: #2ec4b6; }

        .tools-crop { display: flex; flex-direction: column; gap: 10px; }
        .tools-crop-title { margin: 0; font-size: 10px; color: #8a9a9a; }
        .tools-crop-stage { position: relative; max-width: 100%; overflow: hidden; background: #000000; }
        .tools-crop-video { position: absolute; border: 0; }
        .tools-crop-offline { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; margin: 0; color: #9aa0a6; font-size: 14px; }

        .vod-panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .vod-panel-title {
          margin: 0;
          font-size: 14px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #7ef5ff;
        }

        .vod-panel-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .vod-panel-footer {
          margin-top: auto;
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
          padding-top: 12px;
          border-top: 2px solid #1b3b3a;
        }

        .vod-row {
          display: flex;
          align-items: center;
          flex-wrap: wrap;
          gap: 8px;
        }

        .vod-label {
          margin: 0;
          font-size: 10px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #2ec4b6;
        }

        .vod-hint {
          margin-left: 8px;
          color: #8a9a9a;
          font-size: 9px;
          line-height: 1.4;
          letter-spacing: 1px;
        }

        .vod-time, .vod-value {
          color: #ffffff;
          font-size: 11px;
          letter-spacing: 1px;
        }

        .vod-time { margin-left: 8px; }

        .vod-value {
          min-width: 44px;
          text-align: center;
        }

        .vod-input {
          background: transparent;
          border: 2px solid #2ec4b6;
          outline: none;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          padding: 7px 10px;
          caret-color: #7ef5ff;
          box-sizing: border-box;
          width: 100%;
        }

        .vod-input:focus-visible { border-color: #ffd700; }

        .vod-input-time {
          width: 110px;
          text-align: center;
        }

        .vod-btn {
          background: #0a0a0a;
          border: 2px solid #2ec4b6;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          padding: 7px 10px;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
        }

        .vod-btn:hover:not(:disabled), .vod-btn-primary:not(:disabled) {
          background: #2ec4b6;
          color: #000000;
        }

        .vod-btn-primary:hover:not(:disabled) { background: #7ef5ff; }

        .vod-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .vod-btn:focus-visible {
          outline: 2px solid #ffd700;
          outline-offset: 2px;
        }

        .vod-btn-wide { min-width: 84px; }

        .vod-range {
          flex: 1;
          min-width: 120px;
          accent-color: #2ec4b6;
        }

        .vod-check {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          letter-spacing: 1px;
          text-transform: uppercase;
          cursor: pointer;
        }

        .vod-check input {
          accent-color: #2ec4b6;
          width: 16px;
          height: 16px;
          margin: 0;
        }

        .vod-error {
          margin: 0;
          font-size: 10px;
          letter-spacing: 1px;
          color: #ff6b6b;
        }

        /* Single commentator: collapse COM 2 and re-center the section */
        .single-com .commentary-title { top: 613px; }
        .single-com .commentary-container { top: 628px; height: 20px; }
        .single-com .tracking-title { top: 673px; }
        .single-com .tracking-container { top: 691px; }
        .single-com .timer-display { top: 732px; }
      `}</style>

      <div
        className={`overlay-wrapper${commentatorCount === 1 ? " single-com" : ""}`}
        style={stageScale < 1 ? { transform: `scale(${stageScale})` } : undefined}
      >
        {runnerCount !== 2 && (
          <FourPlayerOverlay
            key={runnerCount}
            ref={quadRef}
            layout={runnerCount === 3 ? TRIO_LAYOUT : QUAD_LAYOUT}
            bosses={visibleBosses}
            items={ITEMS}
            bossBadges={bossBadges}
            bossBadgeLabels={BOSS_BADGES}
            itemBadges={itemBadges}
            onBossContextMenu={(id) => cycleBadge(id)}
            onClearBossBadge={clearBossBadge}
            onItemContextMenu={(e, id, type) => openItemMenu(e, "left", id, type)}
            onClearItemBadge={clearItemBadge}
            linkToTimer={linkVodsToTimer}
            onLinkToTimerChange={setLinkVodsToTimer}
            onSidePanelContextMenu={reopenSetup}
            toolsSlot={toolsWin ? quadToolsSlot : null}
            onRequestTools={showTools}
            placements={placements}
            onNamesChange={setQuadNames}
            sidePanel={{
              info: (
                <div className="quad-side-group quad-side-info">
                <textarea
                  className="quad-side-info-input"
                  value={raceInfo}
                  onChange={(e) => setRaceInfo(e.target.value)}
                  placeholder="RACE INFO"
                  aria-label="Race info"
                  rows={2}
                  spellCheck={false}
                  autoComplete="off"
                />
                </div>
              ),
              commentary: (
                <div className="quad-side-group quad-side-commentary">
                <p className="quad-side-title">Commentary</p>
                <input
                  type="text"
                  className="commentary-input quad-side-input"
                  value={commentator1}
                  onChange={(e) => setCommentator1(e.target.value)}
                  placeholder="COM 1"
                  aria-label="Commentator 1"
                  spellCheck={false}
                  autoComplete="off"
                />
                {commentatorCount === 2 && (
                  <input
                    type="text"
                    className="commentary-input quad-side-input"
                    value={commentator2}
                    onChange={(e) => setCommentator2(e.target.value)}
                    placeholder="COM 2"
                    aria-label="Commentator 2"
                    spellCheck={false}
                    autoComplete="off"
                  />
                )}
                </div>
              ),
              tracking: (
                <div className="quad-side-group quad-side-tracking">
                <p className="quad-side-title">Tracking</p>
                <input
                  type="text"
                  className="tracking-input quad-side-input"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="TRACKING"
                  aria-label="Tracking"
                  spellCheck={false}
                  autoComplete="off"
                />
                </div>
              ),
              status: (
                <div className="quad-side-group quad-side-status">
                <button
                  type="button"
                  className={`timer-display quad-side-timer${timerPhase === 1 ? " running" : timerPhase === 2 ? " paused" : ""}`}
                  onClick={handleTimerClick}
                  onContextMenu={(e) => {
                    e.stopPropagation()
                    handleTimerRightClick(e)
                  }}
                  title="Click: start/pause/reset | Right-click: edit start time"
                >
                  {formatTimer(timerMs)}
                </button>
                {isMaxRando && (
                  <button type="button" className="quad-side-gem" onClick={() => setGemPopupOpen(true)} aria-label="Set gem count">
                    <img
                      src="/icons/s_gem_overlay_0.png"
                      alt=""
                      draggable={false}
                    />
                    {gemCount !== null && <span>{gemCount}</span>}
                  </button>
                )}
                </div>
              ),
            }}
          />
        )}

        {runnerCount === 2 && (<>
        {/* VODs render above the overlay art, clipped to the game windows */}
        {(["left", "right"] as const).map((side) => (
          <VodPlayer
            key={side}
            ref={vodRefs[side]}
            side={side}
              config={vods[side]}
              layout={vodLayouts[side]}
              onAutoMute={() => updateVod(side, { muted: true })}
              onSelectAudio={() =>
                setVods((prev) => ({
                  left: { ...prev.left, muted: side !== "left" },
                  right: { ...prev.right, muted: side !== "right" },
                }))
              }
              onVolumeChange={(volume) => updateVod(side, { volume })}
          />
        ))}

        {/* Background overlay image */}
        <img
          src="/overlays/z2r-overlay-flush.png"
          alt="Zelda II Randomizer Restream Overlay"
          className="overlay-bg"
          draggable={false}
        />

        {/* Transparent overlay for top-left black box */}
        <div className="transparent-overlay-left" />

        {/* Transparent overlay for top-right black box */}
        <div className="transparent-overlay-right" />

        {/* Gem — click to set count (max rando only) */}
        {isMaxRando && (
          <img
            src="/icons/s_gem_overlay_0.png"
            alt="Gem"
            className="gem-image"
            draggable={false}
            onClick={() => setGemPopupOpen(true)}
          />
        )}

        {/* Gem count display */}
        {isMaxRando && gemCount !== null && (
          <span className="gem-count">{gemCount}</span>
        )}
        </>)}

        {/* Gem count popup */}
        {gemPopupOpen && (
          <div className="gem-modal-backdrop" onClick={() => setGemPopupOpen(false)}>
            <div className="gem-modal-box" onClick={(e) => e.stopPropagation()}>
              <p className="gem-modal-title">How many gems?</p>
              <div className="gem-modal-options">
                {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                  <button
                    key={n}
                    className={`gem-modal-opt${gemCount === n ? " selected" : ""}`}
                    onClick={() => { setGemCount(n); setGemPopupOpen(false) }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Initial setup popup */}
        {setupOpen && (
          <div className="gem-modal-backdrop">
            <div
              ref={setupBoxRef}
              className="gem-modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="setup-title"
              onKeyDown={handleSetupKeyDown}
            >
              <h2 id="setup-title" className="sr-only">Overlay setup</h2>
              <SetupForm
                id="setup"
                runnerCount={draftRunnerCount}
                commentatorCount={draftCommentatorCount}
                maxRando={draftMaxRando}
                onRunnerCountChange={setDraftRunnerCount}
                onCommentatorCountChange={setDraftCommentatorCount}
                onMaxRandoChange={setDraftMaxRando}
              />
              <p className="setup-hint">
                {popupBlocked
                  ? "Your browser blocked the tools window. Allow popups for this page, then press OK again."
                  : "OK opens a separate tools window for loading, syncing and cropping videos, so viewers never see it."}
              </p>
              <button className="timer-edit-btn" onClick={confirmSetup} autoFocus>OK</button>
            </div>
          </div>
        )}

        {runnerCount === 2 && (<>
        {/* Right-click an empty game window (or the frame around a loaded one) to set up that player's VOD.
            Nothing may cover a loaded VOD during playback, so the full-window hitbox only exists for empty windows. */}
        {(["left", "right"] as const).map((side) => {
          const win = VOD_WINDOWS[side]
          if (hasSource(vods[side])) return null
          return (
            <div
              key={side}
              className="vod-hitbox"
              style={{
                left: win.left,
                top: win.top,
                width: win.width,
                height: win.height,
              }}
              onContextMenu={(e) => openVodPanel(side, e)}
              aria-hidden="true"
            />
          )
        })}


        {/* Right-click anywhere in the center panel to reopen setup */}
        <div className="center-panel-hitbox" onContextMenu={reopenSetup} aria-hidden="true" />

        {/* Commentary section */}
        <div className="commentary-title">COMMENTARY</div>
        <div className="commentary-container" onContextMenu={reopenSetup}>
          <input
            type="text"
            className="commentary-input"
            value={commentator1}
            onChange={(e) => setCommentator1(e.target.value)}
            placeholder="COM 1"
            spellCheck={false}
            autoComplete="off"
          />
          {commentatorCount === 2 && (
            <input
              type="text"
              className="commentary-input"
              value={commentator2}
              onChange={(e) => setCommentator2(e.target.value)}
              placeholder="COM 2"
              spellCheck={false}
              autoComplete="off"
            />
          )}
        </div>

        {/* Tracking section */}
        <div className="tracking-title">TRACKING</div>
        <div className="tracking-container" onContextMenu={reopenSetup}>
          <input
            type="text"
            className="tracking-input"
            value={tracking}
            onChange={(e) => setTracking(e.target.value)}
            placeholder="TRACKING"
            spellCheck={false}
            autoComplete="off"
          />
        </div>

        {/* Timer */}
        <div
          className={`timer-display${timerPhase === 1 ? " running" : timerPhase === 2 ? " paused" : ""}`}
          onClick={handleTimerClick}
          onContextMenu={handleTimerRightClick}
          title="Click: start/pause/reset | Right-click: edit start time"
        >
          {formatTimer(timerMs)}
        </div>
        </>)}

        {toolsWin && (
          <ToolsWindowPortal win={toolsWin}>
            <main className="tools">
              <header className="tools-header">
                <h1 className="tools-heading">Overlay tools</h1>
                <p className="tools-subheading">Only you can see this window. Changes apply to the overlay instantly.</p>
              </header>
              <section className="tools-card" aria-labelledby="tools-setup-title">
                <SetupForm
                  id="tools-setup"
                  title={{ id: "tools-setup-title", text: "Setup" }}
                  runnerCount={runnerCount}
                  commentatorCount={commentatorCount}
                  maxRando={isMaxRando}
                  onRunnerCountChange={applyRunnerCount}
                  onCommentatorCountChange={applyCommentatorCount}
                  onMaxRandoChange={applyMaxRando}
                  placements={placements}
                  playerLabels={runnerCount === 2 ? [leftText, rightText] : quadNames}
                  onPlacementChange={(player, place) => setPlacements((prev) => assignPlace(prev, player, place))}
                />
              </section>
              {runnerCount === 2 ? (
                <PlayerTools
                  id="duo-tools"
                  players={(["left", "right"] as const).map((side) => ({
                    label: duoLabel(side),
                    config: vods[side],
                    onChange: (patch) => updateVod(side, patch),
                    playerRef: vodRefs[side],
                    cropTarget: VOD_WINDOWS[side],
                  }))}
                  selected={toolsSide === "left" ? 0 : 1}
                  onSelect={(i) => setToolsSide(i === 0 ? "left" : "right")}
                  groupLabel="both"
                  linkToTimer={linkVodsToTimer}
                  onLinkToTimerChange={setLinkVodsToTimer}
                  onPlayAll={playBothVods}
                  onPauseAll={pauseBothVods}
                />
              ) : (
                <div ref={setQuadToolsSlot} />
              )}
            </main>
          </ToolsWindowPortal>
        )}

        {/* Timer edit popup */}
        {timerEditOpen && (
          <div className="timer-edit-backdrop" onClick={() => setTimerEditOpen(false)}>
            <div className="timer-edit-box" onClick={(e) => e.stopPropagation()}>
              <p className="timer-edit-title">Set start time</p>
              <input
                className="timer-edit-input"
                value={timerEditValue}
                onChange={(e) => setTimerEditValue(e.target.value)}
                placeholder="0:00:00"
                spellCheck={false}
                autoFocus
                aria-invalid={timerEditInvalid}
                style={timerEditInvalid ? { outline: "2px solid #db2800" } : undefined}
                onKeyDown={(e) => e.key === "Enter" && applyTimerEdit()}
              />
              <button className="timer-edit-btn" onClick={applyTimerEdit} disabled={timerEditInvalid}>Set</button>
            </div>
          </div>
        )}

        {runnerCount === 2 && (<>
        {/* Left editable text box */}
          <div
            className="text-box-left"
            onContextMenu={(e) => {
              if (hasSource(vods.left)) openVodPanel("left", e)
            }}
          >
          <input
            type="text"
            className="zelda-input"
            value={leftText}
            onChange={(e) => handleLeftTextChange(e.target.value)}
            placeholder="PLAYER 1"
            spellCheck={false}
            autoComplete="off"
            style={{ "--zelda-font-size": `${leftFontSize}px` } as React.CSSProperties}
          />
        </div>

        {/* Right editable text box */}
          <div
            className="text-box-right"
            onContextMenu={(e) => {
              if (hasSource(vods.right)) openVodPanel("right", e)
            }}
          >
          <input
            type="text"
            className="zelda-input"
            value={rightText}
            onChange={(e) => handleRightTextChange(e.target.value)}
            placeholder="PLAYER 2"
            spellCheck={false}
            autoComplete="off"
            style={{ "--zelda-font-size": `${rightFontSize}px` } as React.CSSProperties}
          />
        </div>

              <PlaceBadge place={placements[0]} win={VOD_WINDOWS.left} edge="top" />
              <PlaceBadge place={placements[1]} win={VOD_WINDOWS.right} edge="top" />

        {/* Boss tracker — left */}
        <div className="boss-row" role="group" aria-label="Player 1 boss tracker">
          {visibleBosses.map((boss) => (
            <button
              key={boss.id}
              className={`boss-btn ${leftDefeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleLeftBoss(boss.id)}
              onContextMenu={(e) => { e.preventDefault(); cycleBadge(boss.id) }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearBossBadge(boss.id) } }}
              aria-label={`${boss.alt} — ${leftDefeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
              {bossBadges[boss.id] !== undefined && (
                <span className="boss-badge">{BOSS_BADGES[bossBadges[boss.id]]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Boss tracker — right */}
        <div className="boss-row-right" role="group" aria-label="Player 2 boss tracker">
          {visibleBosses.map((boss) => (
            <button
              key={`right-${boss.id}`}
              className={`boss-btn ${rightDefeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleRightBoss(boss.id)}
              onContextMenu={(e) => { e.preventDefault(); cycleBadge(boss.id) }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearBossBadge(boss.id) } }}
              aria-label={`${boss.alt} — ${rightDefeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
              {bossBadges[boss.id] !== undefined && (
                <span className="boss-badge">{BOSS_BADGES[bossBadges[boss.id]]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Item tracker row 1 ��� left */}
        <div className="item-row-1" role="group" aria-label="Player 1 item tracker row 1">
          {ITEMS.slice(0, 8).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${leftCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleLeftItem(item.id)}
              onContextMenu={(e) => openItemMenu(e, "left", item.id, "number")}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearItemBadge(item.id) } }}
              aria-label={`${item.alt} — ${leftCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
              {renderItemBadge(itemBadges[item.id])}
            </button>
          ))}
        </div>

        {/* Item tracker row 2 — left */}
        <div className="item-row-2" role="group" aria-label="Player 1 item tracker row 2">
          {ITEMS.slice(8, 16).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${leftCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleLeftItem(item.id)}
              onContextMenu={(e) => openItemMenu(e, "left", item.id, "letter")}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearItemBadge(item.id) } }}
              aria-label={`${item.alt} — ${leftCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
              {renderItemBadge(itemBadges[item.id])}
            </button>
          ))}
        </div>

        {/* Item tracker row 1 — right */}
        <div className="item-row-1-right" role="group" aria-label="Player 2 item tracker row 1">
          {ITEMS.slice(0, 8).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${rightCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleRightItem(item.id)}
              onContextMenu={(e) => openItemMenu(e, "right", item.id, "number")}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearItemBadge(item.id) } }}
              aria-label={`${item.alt} — ${rightCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
              {renderItemBadge(itemBadges[item.id])}
            </button>
          ))}
        </div>

        {/* Item tracker row 2 — right */}
        <div className="item-row-2-right" role="group" aria-label="Player 2 item tracker row 2">
          {ITEMS.slice(8, 16).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${rightCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleRightItem(item.id)}
              onContextMenu={(e) => openItemMenu(e, "right", item.id, "letter")}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearItemBadge(item.id) } }}
              aria-label={`${item.alt} — ${rightCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
              {renderItemBadge(itemBadges[item.id])}
            </button>
          ))}
        </div>

        {/* Item tracker row 3 — left */}
        <div className="item-row-3" role="group" aria-label="Player 1 item tracker row 3">
          {ITEMS.slice(16, 24).map((item) => (
            <button
              key={item.id}
              className={`item-btn ${leftCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleLeftItem(item.id)}
              onContextMenu={(e) => openItemMenu(e, "left", item.id, "letter")}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearItemBadge(item.id) } }}
              aria-label={`${item.alt} — ${leftCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
              {renderItemBadge(itemBadges[item.id])}
            </button>
          ))}
        </div>

        {/* Item tracker row 3 — right */}
        <div className="item-row-3-right" role="group" aria-label="Player 2 item tracker row 3">
          {ITEMS.slice(16, 24).map((item) => (
            <button
              key={`right-${item.id}`}
              className={`item-btn ${rightCollected.has(item.id) ? "collected" : "active"}`}
              onClick={() => toggleRightItem(item.id)}
              onContextMenu={(e) => openItemMenu(e, "right", item.id, "letter")}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearItemBadge(item.id) } }}
              aria-label={`${item.alt} — ${rightCollected.has(item.id) ? "collected" : "not collected"}`}
              title={item.alt}
            >
              <img src={item.src} alt={item.alt} />
              {renderItemBadge(itemBadges[item.id])}
            </button>
          ))}
        </div>
        </>)}
      </div>

      {/* Item badge context menu */}
      {itemMenu && (
        <div
          ref={itemMenuRef}
          className="item-context-menu"
          style={{ top: itemMenu.y, left: itemMenu.x }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          <div className="item-context-row">
            {CODE_OPTIONS.map((c) => (
              <button key={c} onClick={() => selectItemBadge(c)}>{c}</button>
            ))}
          </div>
          <div className="item-context-row">
            {NUMBER_OPTIONS.map((n) => (
              <button key={n} onClick={() => selectItemBadge(n)}>{n}</button>
            ))}
          </div>
          <div className="item-context-row">
            {LETTER_OPTIONS.map((opt) =>
              opt.clear ? (
                <button key="clear" onClick={() => selectItemBadge(null)} title="Clear" aria-label="Clear badge">
                  <span className="clear-x">{"\u2715"}</span>
                </button>
              ) : (
                <button key={opt.label} onClick={() => selectItemBadge(opt.label)} title={opt.label}>
                  {opt.label}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </>
  )
}
