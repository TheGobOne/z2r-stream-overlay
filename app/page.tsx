"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { TwitchVodPlayer, type VodPlayerHandle } from "@/components/twitch-vod-player"
import { VodPanel } from "@/components/vod-panel"
import { VodCropSelector } from "@/components/vod-crop-selector"
import { FourPlayerOverlay, type QuadOverlayHandle } from "@/components/four-player-overlay"
import { QUAD_LAYOUT, TRIO_LAYOUT } from "@/lib/quad"
import { createVodConfig, hasSource, resolveVodLayouts, UNCROPPED_VIEW, VOD_WINDOWS, type VodConfig, type VodSide } from "@/lib/vod"

const BOSSES = [
  { id: "horsehead",   src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/horsehead-ihboyP4yCXZnzXoI2AtoZIFBnkDEKN.png",   alt: "Horsehead" },
  { id: "helmethead",  src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/helmethead-KfyfAeeYOhwquQq1uRs3fZUfQHeCe6.png",  alt: "Helmethead" },
  { id: "rebonack",    src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/rebonack-zxfzxTTdw7gVkGbediDpNzXQaKiVZb.png",    alt: "Rebonack" },
  { id: "karock",      src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/karock-Ygs9STWmocAZjGJy6uBGyDs9qQif11.png",      alt: "Karock" },
  { id: "gooma",       src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/gooma-rJomB6KNKyZ7GPJuHAGQI6degiEArl.png",       alt: "Gooma" },
  { id: "barba",       src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/barba-pdhNRfOzPJla7oRYees6hb9WT1SI6U.png",       alt: "Barba" },
  { id: "thunderbird", src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/thunderbird-yJKu35CrTvTV46jN5zDqqB9aDJDNaq.png", alt: "Thunderbird" },
]

// Row 1: candle, glove, raft, boots, flute, cross, downstab, upstab
// Row 2: hammer, magickey, trophy, mirror, noteforriverman, wateroflife, water, kid
// Row 3: shield, jump, life, fairy, fire, reflect, spell, thunder
const ITEMS = [
  { id: "candle",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/candle-215T0VkrriKMMF3KNj996UclZvjPrm.png",          alt: "Candle" },
  { id: "glove",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/glove-OEDPJotBIReqdX3PYHnjH8Bi7cte8Q.png",           alt: "Glove" },
  { id: "raft",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/raft-Njv9edZYYpIp9fAlh4IkfQInw0Bu6S.png",            alt: "Raft" },
  { id: "boots",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/boots-3YlIFbtnVXATYwX3G8enKtd9LBtR6u.png",           alt: "Boots" },
  { id: "flute",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/flute-c5UguBIJ4FpbVmBGMY02fLQtRYzI4o.png",           alt: "Flute" },
  { id: "cross",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/cross-0xVtnawiBF2w3Rv2lz5jsYtX3rFCbY.png",           alt: "Cross" },
  { id: "downstab",        src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/downstab-LChMwvu5kaovx9zC9dsCk8iFZ3Z2QV.png",        alt: "Downstab" },
  { id: "upstab",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/upstab-R04iJ6nCHpREpaKmLCyAG69wJtG82A.png",          alt: "Upstab" },
  { id: "hammer",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/hammer-gMBYciaxpn3ddlwv2yvx3DDCDHjEPv.png",          alt: "Hammer" },
  { id: "magickey",        src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/magickey-EzGnClZo5xEMTEJhzc0wJaRsKuD17X.png",        alt: "Magic Key" },
  { id: "trophy",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/trophy-bLgI9Q0JTDoNJWSM2wK6ohPw6GTFSS.png",          alt: "Trophy" },
  { id: "mirror",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/mirror-9ZAZVG4Lh8ZhAXIBs8X6dN3Ec1EI7H.png",          alt: "Mirror" },
  { id: "noteforriverman", src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/noteforriverman-9tVlIuEHCATEIHy9QPM1weChDulMfC.png", alt: "Note for Riverman" },
  { id: "wateroflife",     src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/wateroflife-oDZH7bh4kmZ2zwi2S7xsgk4P7HSnGM.png",     alt: "Water of Life" },
  { id: "water",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/water-1g1wpR7bGmXT6hjLiRSkQxgmmWrC8D.png",           alt: "Water" },
  { id: "kid",             src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/kid-pAWRqLS8Yg8R6Y8b23EUdV82q052cM.png",             alt: "Child" },
  { id: "shield",          src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/shield-1ykMtmxCvcfpYBBoImNlAvClkwCXCh.png",          alt: "Shield" },
  { id: "jump",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/jump-CRoANAOlg9BaNCaluUdq0iTIB6Ejlg.png",            alt: "Jump" },
  { id: "life",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/life-bEtDgJjFmftdUXyk4VjzCDC5xetcc4.png",            alt: "Life" },
  { id: "fairy",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fairy-0mhukM512CWJOuemkBP9l10zrO6pO6.png",           alt: "Fairy" },
  { id: "fire",            src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/fire-SbCeoCfgjlAPAYeIRdrFYL6Eq6jrIM.png",            alt: "Fire" },
  { id: "reflect",         src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/reflect-ViHrAXATIYAIR8nvHk29TU63Wn8YJc.png",         alt: "Reflect" },
  { id: "spell",           src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/spell-JRQjkytihtvztUGdbkioWpXhuyHlm9.png",           alt: "Spell" },
  { id: "thunder",         src: "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/thunder-acYwJLumZAKTqphP3AUuYki6M3oiKt.png",         alt: "Thunder" },
]

export default function StreamOverlay() {
  const [leftText, setLeftText] = useState("")
  const [rightText, setRightText] = useState("")
  const [leftFontSize, setLeftFontSize] = useState(20)
  const [rightFontSize, setRightFontSize] = useState(20)
  const [gemCount, setGemCount] = useState<number | null>(null)
  const [gemPopupOpen, setGemPopupOpen] = useState(false)
  const [commentator1, setCommentator1] = useState("")
  const [commentator2, setCommentator2] = useState("")
  const [tracking, setTracking] = useState("")

  const [setupOpen, setSetupOpen] = useState(true)
  const [commentatorCount, setCommentatorCount] = useState<1 | 2>(2)
  const [isMaxRando, setIsMaxRando] = useState(false)
  const [draftCommentatorCount, setDraftCommentatorCount] = useState<1 | 2>(2)
  const [draftMaxRando, setDraftMaxRando] = useState(false)
  const [runnerCount, setRunnerCount] = useState<2 | 3 | 4>(2)
  const [draftRunnerCount, setDraftRunnerCount] = useState<2 | 3 | 4>(2)
  const visibleBosses = isMaxRando ? BOSSES : BOSSES.filter((boss) => boss.id !== "thunderbird")
  const quadRef = useRef<QuadOverlayHandle>(null)

  function confirmSetup() {
    if (draftRunnerCount !== runnerCount) closeVodPanel()
    setRunnerCount(draftRunnerCount)
    setCommentatorCount(draftCommentatorCount)
    setIsMaxRando(draftMaxRando)
    if (draftCommentatorCount === 1) setCommentator2("")
    setSetupOpen(false)
  }

  function reopenSetup(e: React.MouseEvent) {
    e.preventDefault()
    setDraftCommentatorCount(commentatorCount)
    setDraftMaxRando(isMaxRando)
    setDraftRunnerCount(runnerCount)
    setSetupOpen(true)
  }

  const [vods, setVods] = useState<Record<VodSide, VodConfig>>(() => ({
    left: createVodConfig(),
    right: createVodConfig(),
  }))
  const [vodPanelSide, setVodPanelSide] = useState<VodSide | null>(null)
  const [vodCropMode, setVodCropMode] = useState(false)
  const [linkVodsToTimer, setLinkVodsToTimer] = useState(true)
  const leftVodRef = useRef<VodPlayerHandle>(null)
  const rightVodRef = useRef<VodPlayerHandle>(null)
  const vodRefs = { left: leftVodRef, right: rightVodRef }

  function updateVod(side: VodSide, patch: Partial<VodConfig>) {
    setVods((prev) => ({ ...prev, [side]: { ...prev[side], ...patch } }))
  }

  function playBothVods() {
    // Twitch refuses to play embeds that are covered, and the panel covers the other window
    const panelWasOpen = vodPanelSide !== null
    closeVodPanel()
    window.setTimeout(
      () => {
        leftVodRef.current?.play()
        rightVodRef.current?.play()
      },
      panelWasOpen ? 100 : 0,
    )
  }

  function pauseBothVods() {
    leftVodRef.current?.pause()
    rightVodRef.current?.pause()
  }

  const closeVodPanel = useCallback(() => {
    setVodPanelSide(null)
    setVodCropMode(false)
  }, [])

  function openVodPanel(side: VodSide, e: React.MouseEvent) {
    e.preventDefault()
    setVodCropMode(false)
    setVodPanelSide(side)
  }

  // While picking crop corners, the cropping side shows its whole uncropped video
  const croppingSide = vodPanelSide && vodCropMode && hasSource(vods[vodPanelSide]) ? vodPanelSide : null
  const vodLayouts = resolveVodLayouts(
    croppingSide ? { ...vods, [croppingSide]: { ...vods[croppingSide], ...UNCROPPED_VIEW } } : vods,
  )

  // Timer state: 0 = stopped/reset, 1 = running, 2 = paused
  const [timerPhase, setTimerPhase] = useState<0 | 1 | 2>(0)
  const [timerMs, setTimerMs] = useState(0)
  const [timerEditOpen, setTimerEditOpen] = useState(false)
  const [timerEditValue, setTimerEditValue] = useState("0:00:00")
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerStartRef = useRef<number>(0)
  const timerAccRef = useRef<number>(0)

  useEffect(() => {
    if (timerPhase === 1) {
      timerStartRef.current = Date.now()
      timerRef.current = setInterval(() => {
        setTimerMs(timerAccRef.current + (Date.now() - timerStartRef.current))
      }, 100)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
      if (timerPhase === 2) timerAccRef.current = timerMs
      if (timerPhase === 0) { timerAccRef.current = 0; setTimerMs(0) }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timerPhase])

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
    const raw = timerEditValue.trim()
    const negative = raw.startsWith("-")
    const parts = raw.replace("-", "").split(":").map(Number)
    let ms = 0
    if (parts.length === 3) ms = ((parts[0] * 3600) + (parts[1] * 60) + parts[2]) * 1000
    else if (parts.length === 2) ms = ((parts[0] * 60) + parts[1]) * 1000
    if (negative) ms = -ms
    timerAccRef.current = ms
    setTimerMs(ms)
    setTimerEditOpen(false)
  }

  const [leftDefeated, setLeftDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))
  const [rightDefeated, setRightDefeated] = useState<Set<string>>(new Set(BOSSES.map(b => b.id)))

  // Boss badge cycling: W -> E -> MI -> DV -> clear
  const BOSS_BADGES = ["W", "E", "MI", "DV"]
  const [leftBossBadge, setLeftBossBadge] = useState<Record<string, number>>({})
  const [rightBossBadge, setRightBossBadge] = useState<Record<string, number>>({})

  function cycleBadge(
    _setter: React.Dispatch<React.SetStateAction<Record<string, number>>>,
    id: string,
  ) {
    const updater = (prev: Record<string, number>) => {
      const next = { ...prev }
      const current = prev[id]
      if (current === undefined) next[id] = 0
      else if (current >= BOSS_BADGES.length - 1) delete next[id]
      else next[id] = current + 1
      return next
    }
    // Mirror the boss badge across both players
    setLeftBossBadge(updater)
    setRightBossBadge(updater)
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
  const [leftItemBadge, setLeftItemBadge] = useState<Record<string, string>>({})
  const [rightItemBadge, setRightItemBadge] = useState<Record<string, string>>({})

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
    const updater = (prev: Record<string, string>) => {
      const next = { ...prev }
      if (value === null) delete next[itemMenu.itemId]
      else next[itemMenu.itemId] = value
      return next
    }
    // Mirror the badge across both players
    setLeftItemBadge(updater)
    setRightItemBadge(updater)
    setItemMenu(null)
  }

  function clearItemBadge(itemId: string) {
    const updater = (prev: Record<string, string>) => {
      const next = { ...prev }
      delete next[itemId]
      return next
    }
    setLeftItemBadge(updater)
    setRightItemBadge(updater)
  }

  function clearBossBadge(bossId: string) {
    const updater = (prev: Record<string, number>) => {
      const next = { ...prev }
      delete next[bossId]
      return next
    }
    setLeftBossBadge(updater)
    setRightBossBadge(updater)
  }

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
    if (text.length === 0) return 20
    if (text.length <= 6) return 20
    if (text.length <= 10) return 18
    if (text.length <= 14) return 14
    return 10
  }

  function handleLeftTextChange(value: string) {
    setLeftText(value)
    setLeftFontSize(calculateFontSize(value))
  }

  function handleRightTextChange(value: string) {
    setRightText(value)
    setRightFontSize(calculateFontSize(value))
  }

  function handleGemMouseDown(e: React.MouseEvent) {
    setIsDraggingGem(true)
    setDragOffsetX(e.clientX - gemX)
    setDragOffsetY(e.clientY - gemY)
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!isDraggingGem) return
    setGemX(e.clientX - dragOffsetX)
    setGemY(e.clientY - dragOffsetY)
  }

  function handleMouseUp() {
    setIsDraggingGem(false)
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
        }

        /* Left box */
        .text-box-left {
          position: absolute;
          left: 42px;
          top: 516px;
          width: 284px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Right box */
        .text-box-right {
          position: absolute;
          right: 42px;
          top: 516px;
          width: 284px;
          height: 62px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .zelda-input {
          width: 100%;
          height: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
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
             overlaps it. The per-side z-index is set inline by TwitchVodPlayer. */
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

        .vod-audio-badge {
          position: absolute;
          right: 6px;
          bottom: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 6px;
  background: #ffffff;
  color: #000000;
  pointer-events: none;
  }
  
  .vod-audio-badge-right {
  right: auto;
  left: 6px;
  }

  .vod-audio-badge svg {
  width: 24px;
  height: 24px;
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

      <div className={`overlay-wrapper${commentatorCount === 1 ? " single-com" : ""}`}>
        {runnerCount !== 2 && (
          <FourPlayerOverlay
            key={runnerCount}
            ref={quadRef}
            layout={runnerCount === 3 ? TRIO_LAYOUT : QUAD_LAYOUT}
            bosses={visibleBosses}
            items={ITEMS}
            bossBadges={leftBossBadge}
            bossBadgeLabels={BOSS_BADGES}
            itemBadges={leftItemBadge}
            onBossContextMenu={(id) => cycleBadge(setLeftBossBadge, id)}
            onClearBossBadge={clearBossBadge}
            onItemContextMenu={(e, id, type) => openItemMenu(e, "left", id, type)}
            onClearItemBadge={clearItemBadge}
            linkToTimer={linkVodsToTimer}
            onLinkToTimerChange={setLinkVodsToTimer}
            onSidePanelContextMenu={reopenSetup}
            sidePanel={
              <>
                <div className="quad-side-group">
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
                <div className="quad-side-group">
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
                      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/s_gem_overlay_0-hDegjlqJriaY5Z5xY4Cb924PFsBnS7.png"
                      alt=""
                      draggable={false}
                    />
                    {gemCount !== null && <span>{gemCount}</span>}
                  </button>
                )}
                </div>
              </>
            }
          />
        )}

        {runnerCount === 2 && (<>
        {/* Twitch VODs render above the overlay art, clipped to the game windows */}
        {(["left", "right"] as const).map((side) => (
          <TwitchVodPlayer
            key={side}
            ref={vodRefs[side]}
            side={side}
            config={vods[side]}
            layout={vodLayouts[side]}
            onAutoMute={() => updateVod(side, { muted: true })}
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
            src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/s_gem_overlay_0-hDegjlqJriaY5Z5xY4Cb924PFsBnS7.png"
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
              className="gem-modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="setup-title"
              onKeyDown={(e) => e.key === "Enter" && confirmSetup()}
            >
              <div className="setup-section">
                <p id="setup-title" className="gem-modal-title">How many runners?</p>
                <div className="gem-modal-options" role="radiogroup" aria-label="Number of runners">
                  {([2, 3, 4] as const).map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={draftRunnerCount === n}
                      className={`gem-modal-opt${draftRunnerCount === n ? " selected" : ""}`}
                      onClick={() => setDraftRunnerCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setup-section">
                <p className="gem-modal-title">How many commentators?</p>
                <div className="gem-modal-options" role="radiogroup" aria-label="Number of commentators">
                  {([1, 2] as const).map((n) => (
                    <button
                      key={n}
                      role="radio"
                      aria-checked={draftCommentatorCount === n}
                      className={`gem-modal-opt${draftCommentatorCount === n ? " selected" : ""}`}
                      onClick={() => setDraftCommentatorCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="setup-section">
                <label className="setup-checkbox">
                  <input
                    type="checkbox"
                    checked={draftMaxRando}
                    onChange={(e) => setDraftMaxRando(e.target.checked)}
                  />
                  Max Rando
                </label>
              </div>
              <p className="setup-hint">Right-click a game window to load a Twitch VOD or livestream</p>
              <button className="timer-edit-btn" onClick={confirmSetup} autoFocus>OK</button>
            </div>
          </div>
        )}

        {runnerCount === 2 && (<>
        {/* Right-click an empty game window (or the frame around a loaded one) to set up that player's VOD.
            Nothing may cover a loaded VOD during playback, so the full-window hitbox only exists for empty windows. */}
        {(["left", "right"] as const).map((side) => {
          const win = VOD_WINDOWS[side]
          const hasVod = hasSource(vods[side])
          if (croppingSide === side) {
            return (
              <VodCropSelector
                key={side}
                win={win}
                frame={vodLayouts[side]}
                onApply={(view) => {
                  updateVod(side, view)
                  setVodCropMode(false)
                }}
                onCancel={() => setVodCropMode(false)}
              />
            )
          }
          if (hasVod) return null
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

        {vodPanelSide && !croppingSide && (
          <VodPanel
            key={vodPanelSide}
            side={vodPanelSide}
            playerLabel={(vodPanelSide === "left" ? leftText : rightText) || (vodPanelSide === "left" ? "Player 1" : "Player 2")}
            config={vods[vodPanelSide]}
            onChange={(patch) => updateVod(vodPanelSide, patch)}
            playerRef={vodRefs[vodPanelSide]}
              cropMode={vodCropMode}
              onCropModeChange={setVodCropMode}
            linkToTimer={linkVodsToTimer}
            onLinkToTimerChange={setLinkVodsToTimer}
            onPlayBoth={playBothVods}
            onPauseBoth={pauseBothVods}
            onClose={closeVodPanel}
          />
        )}

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
                onKeyDown={(e) => e.key === "Enter" && applyTimerEdit()}
              />
              <button className="timer-edit-btn" onClick={applyTimerEdit}>Set</button>
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

        {/* Boss tracker — left */}
        <div className="boss-row" role="group" aria-label="Player 1 boss tracker">
          {visibleBosses.map((boss) => (
            <button
              key={boss.id}
              className={`boss-btn ${leftDefeated.has(boss.id) ? "defeated" : "active"}`}
              onClick={() => toggleLeftBoss(boss.id)}
              onContextMenu={(e) => { e.preventDefault(); cycleBadge(setLeftBossBadge, boss.id) }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearBossBadge(boss.id) } }}
              aria-label={`${boss.alt} — ${leftDefeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
              {leftBossBadge[boss.id] !== undefined && (
                <span className="boss-badge">{BOSS_BADGES[leftBossBadge[boss.id]]}</span>
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
              onContextMenu={(e) => { e.preventDefault(); cycleBadge(setRightBossBadge, boss.id) }}
              onAuxClick={(e) => { if (e.button === 1) { e.preventDefault(); clearBossBadge(boss.id) } }}
              aria-label={`${boss.alt} — ${rightDefeated.has(boss.id) ? "defeated" : "alive"}`}
              title={boss.alt}
            >
              <img src={boss.src} alt={boss.alt} />
              {rightBossBadge[boss.id] !== undefined && (
                <span className="boss-badge">{BOSS_BADGES[rightBossBadge[boss.id]]}</span>
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
              {renderItemBadge(leftItemBadge[item.id])}
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
              {renderItemBadge(leftItemBadge[item.id])}
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
              {renderItemBadge(rightItemBadge[item.id])}
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
              {renderItemBadge(rightItemBadge[item.id])}
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
              {renderItemBadge(leftItemBadge[item.id])}
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
              {renderItemBadge(rightItemBadge[item.id])}
            </button>
          ))}
        </div>
        </>)}
      </div>

      {/* Item badge context menu */}
      {itemMenu && (
        <div
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
