"use client"

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react"
import { VodPlayer, type VodPlayerHandle } from "@/components/vod-player"
import { AudioBadge } from "@/components/audio-badge"
import { PlayerTools } from "@/components/player-tools"
import { SetupForm } from "@/components/setup-form"
import { assignPlace, PlaceBadge, type Place, type Placements } from "@/components/place-badge"
import { openToolsWindow, ToolsWindowPortal } from "@/components/tools-window"
import { FourPlayerOverlay, type QuadOverlayHandle } from "@/components/four-player-overlay"
import { TrackerTools } from "@/components/tracker-tools"
import { RacetimeTools } from "@/components/racetime-tools"
import { SeriesPips } from "@/components/series-pips"
import { SeriesTools } from "@/components/series-tools"
import { RemoteTrackerTools } from "@/components/remote-tracker-tools"
import { hostTrackers, newJoinCode, type TrackerAction, type TrackerHost, type TrackerSnapshot } from "@/lib/tracker-link"
import { fetchRace, parseRoom, type RacetimeRace, type RacetimeRunner } from "@/lib/racetime"
import { QUAD_LAYOUT, TRIO_LAYOUT } from "@/lib/quad"
import { BOSSES, ITEMS } from "@/lib/tracker-catalog"
import { ARCADE_WINDOWS, createVodConfig, hasSource, resolveVodLayouts, VOD_WINDOWS, type VodConfig, type VodSide } from "@/lib/vod"
import { ArcadeDecor } from "@/components/arcade-decor"
import { useFitFontSize } from "@/lib/use-fit-font"

const STATE_STORAGE_KEY = "z2r-overlay-state"
const TIMER_STORAGE_KEY = "z2r-overlay-timer"


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
  // Arcade is the only look for now; the Classic brick art is still in the code for when it's wanted back
  const [theme] = useState<"classic" | "arcade">("arcade")
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

  // Trio and quad tracker state lives here (not in the overlay) so the tools window can edit it
  const freshQuadSets = (ids: string[]) => Array.from({ length: 4 }, () => new Set(ids))
  const [quadNotDefeated, setQuadNotDefeated] = useState(() => freshQuadSets(BOSSES.map((b) => b.id)))
  const [quadNotCollected, setQuadNotCollected] = useState(() => freshQuadSets(ITEMS.map((i) => i.id)))

  function toggleInRunner(sets: Set<string>[], runner: number, id: string) {
    return sets.map((set, i) => {
      if (i !== runner) return set
      const next = new Set(set)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }
  const toggleQuadBoss = (runner: number, id: string) => setQuadNotDefeated((prev) => toggleInRunner(prev, runner, id))
  const toggleQuadItem = (runner: number, id: string) => setQuadNotCollected((prev) => toggleInRunner(prev, runner, id))

  function applyRunnerCount(n: 2 | 3 | 4) {
    if (n !== runnerCount) {
      setPlacements(Array(4).fill(null))
      setQuadNames([])
      setQuadNotDefeated(freshQuadSets(BOSSES.map((b) => b.id)))
      setQuadNotCollected(freshQuadSets(ITEMS.map((i) => i.id)))
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
  const [linkVodsToTimer, setLinkVodsToTimer] = useState(false)
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

  // Timer back to 0: stop every video and return it to the start time it was loaded with
  function resetVods() {
    if (runnerCount !== 2) {
      quadRef.current?.resetAll()
      return
    }
    pauseBothVods()
    leftVodRef.current?.seekTo(vods.left.startSeconds)
    rightVodRef.current?.seekTo(vods.right.startSeconds)
  }

  function openVodPanel(side: VodSide, e: React.MouseEvent) {
    e.preventDefault()
    setToolsSide(side)
    showTools()
  }

  const duoWindows = theme === "arcade" ? ARCADE_WINDOWS : VOD_WINDOWS
  // Arcade names stay full size until they fill their box, then shrink just enough to fit
  const leftNameRef = useRef<HTMLInputElement>(null)
  const rightNameRef = useRef<HTMLInputElement>(null)
  const arcadeNameOpts = { base: 24, min: 10, letterSpacing: 2, enabled: theme === "arcade" }
  const leftArcadeSize = useFitFontSize(leftNameRef, leftText, arcadeNameOpts)
  const rightArcadeSize = useFitFontSize(rightNameRef, rightText, arcadeNameOpts)
  const vodLayouts = resolveVodLayouts(vods, duoWindows)
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
    // Left click toggles: stopped or paused -> running, running -> paused. Middle click resets.
    const next = timerPhase === 1 ? 2 : 1
    setTimerPhase(next)
    if (linkVodsToTimer) {
      if (runnerCount !== 2) {
        if (next === 1) quadRef.current?.playAll()
        else quadRef.current?.pauseAll()
      } else if (next === 1) playBothVods()
      else pauseBothVods()
    }
  }

  function handleTimerMiddleClick(e: React.MouseEvent) {
    if (e.button !== 1) return
    e.preventDefault()
    setTimerPhase(0)
    if (linkVodsToTimer) resetVods()
  }

  function handleTimerRightClick(e: React.MouseEvent) {
    e.preventDefault()
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerPhase(0)
    timerAccRef.current = 0
    setTimerMs(0)
    if (linkVodsToTimer) resetVods()
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

  // Racetime.gg room: names, live channels and the race clock come from the room's public feed
  const [racetimeRoom, setRacetimeRoom] = useState<string | null>(null)
  const [racetimeSummary, setRacetimeSummary] = useState("")
  const [racetimeError, setRacetimeError] = useState("")
  const [racetimeBusy, setRacetimeBusy] = useState(false)
  const racetimeRunnersRef = useRef<RacetimeRunner[]>([])
  const racetimeEndedRef = useRef(false)
  // Best-of series: games already won per runner, shown as squares on the name plates
  const SERIES_KEY = "z2r-series"
  const [seriesBestOf, setSeriesBestOf] = useState<1 | 3 | 5>(3)
  const [seriesWins, setSeriesWins] = useState<number[]>([0, 0, 0, 0])
  const seriesAwardedRef = useRef<Set<string>>(new Set())
  const seriesToWin = Math.ceil(seriesBestOf / 2)
  const seriesShown = seriesBestOf > 1 ? seriesToWin : 0
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SERIES_KEY) ?? "null")
      if (saved?.bestOf === 1 || saved?.bestOf === 3 || saved?.bestOf === 5) setSeriesBestOf(saved.bestOf)
      if (Array.isArray(saved?.wins)) setSeriesWins([0, 1, 2, 3].map((i) => Math.max(0, Number(saved.wins[i]) || 0)))
      if (Array.isArray(saved?.awarded)) seriesAwardedRef.current = new Set(saved.awarded.map(String))
    } catch {}
  }, [])
  function saveSeries(bestOf: number, wins: number[]) {
    try {
      localStorage.setItem(SERIES_KEY, JSON.stringify({ bestOf, wins, awarded: [...seriesAwardedRef.current] }))
    } catch {}
  }
  function changeSeriesWins(runner: number, value: number) {
    setSeriesWins((prev) => {
      const next = prev.map((w, i) => (i === runner ? value : w))
      saveSeries(seriesBestOf, next)
      return next
    })
  }
  function changeSeriesBestOf(value: 1 | 3 | 5) {
    setSeriesBestOf(value)
    const cap = Math.ceil(value / 2)
    setSeriesWins((prev) => {
      const next = prev.map((w) => Math.min(w, cap))
      saveSeries(value, next)
      return next
    })
  }
  // Last place set from racetime per runner name, so a hand-set badge is only replaced when racetime changes
  const racetimePlacesRef = useRef<Record<string, Place | null>>({})
  const timerPhaseRef = useRef(timerPhase)
  timerPhaseRef.current = timerPhase

  function applyRunners(runners: RacetimeRunner[]) {
    if (runnerCount === 2) {
      const sides = ["left", "right"] as const
      sides.forEach((side, i) => {
        const runner = runners[i]
        if (!runner) return
        if (side === "left") handleLeftTextChange(runner.name)
        else handleRightTextChange(runner.name)
        const channel = runner.channel
        if (!channel) return
        setVods((prev) => ({
          ...prev,
          [side]: {
            ...prev[side],
            url: `https://twitch.tv/${channel}`,
            platform: "twitch",
            videoId: null,
            channel,
            startSeconds: 0,
            loadKey: prev[side].loadKey + 1,
          },
        }))
      })
    } else {
      quadRef.current?.setRunners(runners.map((r) => ({ name: r.name, channel: r.channel })))
    }
  }

  /** Sets each runner's place badge from racetime: their place when done, DNF when they forfeit or are disqualified. */
  function syncPlaces(race: RacetimeRace) {
    const order = racetimeRunnersRef.current
    order.forEach((known, index) => {
      if (index >= runnerCount) return
      const runner = race.runners.find((r) => r.name.toLowerCase() === known.name.toLowerCase())
      if (!runner) return
      const place: Place | null =
        runner.status === "dnf" || runner.status === "dq"
          ? "dnf"
          : runner.status === "done" && runner.place !== null && runner.place >= 1 && runner.place <= 4
            ? (runner.place as Place)
            : null
      const key = runner.name.toLowerCase()
      if (place === null || racetimePlacesRef.current[key] === place) return
      racetimePlacesRef.current[key] = place
      setPlacements((prev) => assignPlace(prev, index, place))
      // The winner of this room takes a game in the series, once per room
      const award = `${race.room}:${key}`
      if (place === 1 && !seriesAwardedRef.current.has(award)) {
        seriesAwardedRef.current.add(award)
        setSeriesWins((prev) => {
          const next = prev.map((w, i) => (i === index ? Math.min(w + 1, seriesToWin) : w))
          saveSeries(seriesBestOf, next)
          return next
        })
      }
    })
  }

  function syncRace(race: RacetimeRace) {
    syncPlaces(race)
    const label = race.status.replace(/_/g, " ")
    setRacetimeSummary(`${label ? label[0].toUpperCase() + label.slice(1) : "Unknown"}, ${race.runners.length} runner${race.runners.length === 1 ? "" : "s"}.`)
    if (race.startMs === null) return
    const now = Date.now()
    if (race.endMs !== null) {
      if (racetimeEndedRef.current) return
      racetimeEndedRef.current = true
      const final = race.endMs - race.startMs
      timerAccRef.current = final
      timerStartRef.current = 0
      setTimerMs(final)
      setTimerPhase(2)
      return
    }
    racetimeEndedRef.current = false
    const elapsed = now - race.startMs
    if (timerPhaseRef.current !== 1) {
      timerAccRef.current = elapsed
      setTimerPhase(1)
      if (linkVodsToTimer) {
        if (runnerCount !== 2) quadRef.current?.playAll()
        else playBothVods()
      }
    } else if (Math.abs(timerAccRef.current + (now - timerStartRef.current) - elapsed) > 1000) {
      timerAccRef.current = elapsed
      timerStartRef.current = now
    }
  }
  const syncRaceRef = useRef(syncRace)
  syncRaceRef.current = syncRace

  async function importRacetime(input: string) {
    const room = parseRoom(input)
    if (!room) {
      setRacetimeError("Paste a racetime.gg room link, like https://racetime.gg/z2r/room-name-1234")
      return
    }
    setRacetimeBusy(true)
    setRacetimeError("")
    try {
      const race = await fetchRace(room)
      if (race.runners.length === 0) {
        setRacetimeError("Nobody has joined that room yet")
        return
      }
      if (room !== racetimeRoom && !(toolsWin ?? window).confirm("Importing a new room clears the tracker (bosses, items and badges). Continue?")) return
      if (room !== racetimeRoom) clearTrackers()
      racetimeRunnersRef.current = race.runners
      racetimeEndedRef.current = false
      racetimePlacesRef.current = {}
      setRacetimeRoom(room)
      applyRunners(race.runners)
      syncRace(race)
    } catch (error) {
      setRacetimeError(error instanceof Error ? error.message : "Could not import that room")
    } finally {
      setRacetimeBusy(false)
    }
  }

  function swapRacetimeRunners() {
    racetimeRunnersRef.current = [...racetimeRunnersRef.current].reverse()
    applyRunners(racetimeRunnersRef.current)
  }

  function unlinkRacetime() {
    setRacetimeRoom(null)
    setRacetimeSummary("")
    setRacetimeError("")
  }

  useEffect(() => {
    if (!racetimeRoom) return
    let stopped = false
    const poll = window.setInterval(async () => {
      try {
        const race = await fetchRace(racetimeRoom)
        if (stopped) return
        setRacetimeError("")
        syncRaceRef.current(race)
      } catch (error) {
        if (!stopped) setRacetimeError(error instanceof Error ? error.message : "Lost the connection to racetime.gg")
      }
    }, 5000)
    return () => {
      stopped = true
      window.clearInterval(poll)
    }
  }, [racetimeRoom])

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

  // One master item set for marking locations; it greys icons in the tools window only
  const [markedOff, setMarkedOff] = useState<Set<string>>(new Set())
  function toggleMarked(itemId: string) {
    setMarkedOff((prev) => {
      const next = new Set(prev)
      next.has(itemId) ? next.delete(itemId) : next.add(itemId)
      return next
    })
  }

  function setItemBadge(itemId: string, value: string | null) {
    setItemBadges((prev) => {
      const next = { ...prev }
      if (value === null) delete next[itemId]
      else next[itemId] = value
      return next
    })
  }

  const [markedBossesOff, setMarkedBossesOff] = useState<Set<string>>(new Set())
  function toggleMarkedBoss(bossId: string) {
    setMarkedBossesOff((prev) => {
      const next = new Set(prev)
      next.has(bossId) ? next.delete(bossId) : next.add(bossId)
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

  // Bumped to remount the trio/quad overlay, which keeps its own names, videos and tracker state
  const [clearCount, setClearCount] = useState(0)

  /** Resets bosses, items, badges and marks on every layout; names, videos and the timer stay. */
  function clearTrackers() {
    setLeftDefeated(new Set(BOSSES.map((b) => b.id)))
    setRightDefeated(new Set(BOSSES.map((b) => b.id)))
    setLeftCollected(new Set(ITEMS.map((i) => i.id)))
    setRightCollected(new Set(ITEMS.map((i) => i.id)))
    setBossBadges({})
    setItemBadges({})
    setItemMenu(null)
    setQuadNotDefeated(freshQuadSets(BOSSES.map((b) => b.id)))
    setQuadNotCollected(freshQuadSets(ITEMS.map((i) => i.id)))
    setMarkedOff(new Set())
    setMarkedBossesOff(new Set())
  }

  /** Resets everything per-race; runner/commentator counts and Max Rando stay as set up. */
  function clearOverlay() {
    if (!(toolsWin ?? window).confirm("Clear names, videos, timer, badges and tracker icons?")) return
    setLeftText("")
    setRightText("")
    setCommentator1("")
    setCommentator2("")
    setTracking("")
    setRaceInfo("")
    setGemCount(null)
    setLeftDefeated(new Set(BOSSES.map((b) => b.id)))
    setRightDefeated(new Set(BOSSES.map((b) => b.id)))
    setLeftCollected(new Set(ITEMS.map((i) => i.id)))
    setRightCollected(new Set(ITEMS.map((i) => i.id)))
    setBossBadges({})
    setItemBadges({})
    setItemMenu(null)
    setPlacements(Array(4).fill(null))
    setQuadNames([])
    setQuadNotDefeated(freshQuadSets(BOSSES.map((b) => b.id)))
    setQuadNotCollected(freshQuadSets(ITEMS.map((i) => i.id)))
    setMarkedOff(new Set())
    setMarkedBossesOff(new Set())
    setSeriesWins([0, 0, 0, 0])
    seriesAwardedRef.current = new Set()
    saveSeries(seriesBestOf, [0, 0, 0, 0])
    setVods({ left: createVodConfig(), right: createVodConfig() })
    setClearCount((n) => n + 1)
    if (timerRef.current) clearInterval(timerRef.current)
    setTimerPhase(0)
    timerAccRef.current = 0
    setTimerMs(0)
  }


  // Remote trackers: other people mark items and bosses from their own browser with a join code
  const TRACKER_CODE_KEY = "z2r-tracker-code"
  const [trackerCode, setTrackerCode] = useState("")
  const [trackerSharing, setTrackerSharing] = useState(false)
  const [trackerBusy, setTrackerBusy] = useState(false)
  const [trackerError, setTrackerError] = useState("")
  const [trackerCount, setTrackerCount] = useState(0)
  const trackerHostRef = useRef<TrackerHost | null>(null)

  useEffect(() => {
    let code = ""
    try {
      code = localStorage.getItem(TRACKER_CODE_KEY) ?? ""
    } catch {}
    if (!code) {
      code = newJoinCode()
      try {
        localStorage.setItem(TRACKER_CODE_KEY, code)
      } catch {}
    }
    setTrackerCode(code)
  }, [])

  const trackerRunners: TrackerSnapshot["runners"] =
    runnerCount === 2
      ? [
          { name: leftText, bossesGreyed: [...leftDefeated], itemsGreyed: [...leftCollected] },
          { name: rightText, bossesGreyed: [...rightDefeated], itemsGreyed: [...rightCollected] },
        ]
      : Array.from({ length: runnerCount }, (_, i) => ({
          name: quadNames[i] ?? "",
          bossesGreyed: [...(quadNotDefeated[i] ?? [])],
          itemsGreyed: [...(quadNotCollected[i] ?? [])],
        }))
  const trackerSnapshot: TrackerSnapshot = {
    runners: trackerRunners,
    bossBadges,
    bossBadgeLabels: BOSS_BADGES,
    itemBadges,
    badgeOptions: [CODE_OPTIONS, NUMBER_OPTIONS, LETTER_OPTIONS.filter((o) => !o.clear).map((o) => o.label)],
  }
  const trackerSnapshotJson = JSON.stringify(trackerSnapshot)
  useEffect(() => {
    trackerHostRef.current?.broadcast(JSON.parse(trackerSnapshotJson))
  }, [trackerSnapshotJson, trackerSharing])

  const trackerActionRef = useRef<(action: TrackerAction) => void>(() => {})
  trackerActionRef.current = (action) => {
    if (action.type === "cycleBossBadge" || action.type === "clearBossBadge") {
      return action.type === "cycleBossBadge" ? cycleBadge(action.id) : clearBossBadge(action.id)
    }
    if (action.type === "setItemBadge") return setItemBadge(action.id, action.value)
    const { type, runner, id } = action
    if (runnerCount === 2) {
      if (type === "toggleBoss") (runner === 0 ? toggleLeftBoss : toggleRightBoss)(id)
      else (runner === 0 ? toggleLeftItem : toggleRightItem)(id)
    } else if (type === "toggleBoss") toggleQuadBoss(runner, id)
    else toggleQuadItem(runner, id)
  }

  async function startTrackerSharing(code = trackerCode) {
    if (!code || trackerBusy) return
    setTrackerBusy(true)
    setTrackerError("")
    try {
      trackerHostRef.current = await hostTrackers(code, (action) => trackerActionRef.current(action), setTrackerCount)
      setTrackerSharing(true)
    } catch (error) {
      setTrackerError(error instanceof Error ? error.message : "Could not start sharing")
    } finally {
      setTrackerBusy(false)
    }
  }

  function stopTrackerSharing() {
    trackerHostRef.current?.stop()
    trackerHostRef.current = null
    setTrackerSharing(false)
  }

  function makeNewTrackerCode() {
    const code = newJoinCode()
    try {
      localStorage.setItem(TRACKER_CODE_KEY, code)
    } catch {}
    setTrackerCode(code)
    if (trackerSharing) {
      stopTrackerSharing()
      void startTrackerSharing(code)
    }
  }

  useEffect(() => () => trackerHostRef.current?.stop(), [])

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

  // A timer that was running when the page reloaded gets its linked videos started again
  const resumeVodsRef = useRef(false)

  // Restore what was on screen after a reload (OBS cache refresh, crash, accidental F5)
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (!hydrated || !resumeVodsRef.current) return
    resumeVodsRef.current = false
    if (!linkVodsToTimer) return
    if (runnerCount !== 2) quadRef.current?.playAll()
    else playBothVods()
  }, [hydrated])
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
        if (timer.phase === 1) resumeVodsRef.current = true
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
          /* The font's letters sit about 0.2em below the line's middle, so the lift grows with the size */
          top: calc(var(--zelda-font-size, 18px) * -0.2);
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

        /* Audio badge sits at the inner end of a runner's name plate, off the video:
           Twitch refuses script play() while anything covers its iframe. */
        .series-pips {
          position: absolute;
          left: 8px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          gap: 2px;
          z-index: 2;
          pointer-events: none;
        }

        .series-pip {
          width: 16px;
          height: 14px;
          display: block;
          fill: transparent;
          stroke: #f8b800;
          stroke-width: 1.2;
          stroke-linejoin: miter;
          opacity: 0.6;
        }

        .series-pip.won {
          fill: #f8b800;
          opacity: 1;
        }

        .vod-audio {
          position: absolute;
          right: 6px;
          top: 50%;
          transform: translateY(-50%);
          z-index: 2;
          display: inline-flex;
          padding: 0;
          border: 0;
          background: none;
          cursor: pointer;
          user-select: none;
          color: #FFE040;
        }
        .vod-audio svg { display: block; }
        .vod-audio-muted { color: #55557A; }
        .vod-audio-muted:hover { color: #FFE040; }
        .vod-audio:focus-visible { outline: 2px solid #FF4040; outline-offset: 2px; }

        .vod-volume-pop {
          position: absolute;
          right: 0;
          bottom: calc(100% + 6px);
          white-space: nowrap;
        }

        /* The video windows sit at z-index 13-14, which hid the volume box that opens above the
           name plate. Lift the plate only while the box is open so nothing covers a Twitch frame otherwise. */
        .text-box-left:has(.vod-volume-pop),
        .text-box-right:has(.vod-volume-pop),
        .quad-tracker:has(.vod-volume-pop),
        .quad-rail:has(.vod-volume-pop) {
          z-index: 905;
        }

        .text-box-left .zelda-input,
        .text-box-right .zelda-input,
        .quad-name .zelda-input {
          padding-left: 46px;
          padding-right: 34px;
          box-sizing: border-box;
        }

        /* The font's letters sit about 0.2em below the line's middle; lift them by the same share */
        .quad-name .zelda-input {
          transform: translateY(calc(var(--zelda-font-size, 13px) * -0.2));
        }

        .vod-audio-badge {
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 0;
  border-radius: 4px;
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
  width: 18px;
  height: 18px;
  }

  .vod-audio-badge-muted::after {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 3px;
  height: 22px;
  background: #000000;
  box-shadow: 0 0 0 1.5px #ffffff;
  transform: translate(-50%, -50%) rotate(45deg);
  }

  .vod-audio-badge-muted {
  opacity: 0;
  transition: opacity 120ms ease;
  }

  .text-box-left:hover .vod-audio-badge-muted,
  .text-box-right:hover .vod-audio-badge-muted,
  .quad-name:hover .vod-audio-badge-muted,
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

        .tools-hint { margin: 0; font-size: 9px; color: #8a9a9a; line-height: 1.6; }
        .tools-tracker-grid { display: flex; flex-wrap: wrap; gap: 8px; }
        .tools-tracker-grid .item-btn.tools-picking { outline: 2px solid #2ec4b6; outline-offset: 2px; }
        .tools-badge-menu { position: static; align-self: flex-start; }
        .tools-badge-menu .tools-hint { padding: 4px; }

        .tools-clear-btn {
          align-self: flex-start;
          padding: 10px 16px;
          font-family: inherit;
          font-size: 11px;
          color: #ffffff;
          background: #7a1d0d;
          border: 2px solid #db2800;
          cursor: pointer;
        }
        .tools-clear-btn:hover { background: #db2800; }

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

        /* ===== Tools window in the Arcade look: black starfield, striped bars, stepped cyan frames ===== */
        .tools {
          background:
            linear-gradient(180deg, #FF4040 0 2px, #000 2px 3px, #FF9020 3px 5px, #000 5px 6px, #FFE040 6px 8px, #000 8px) top / 100% 9px no-repeat,
            radial-gradient(1px 1px at 8% 12%, #fff 99%, transparent),
            radial-gradient(1px 1px at 23% 41%, #FFE040 99%, transparent),
            radial-gradient(2px 2px at 41% 8%, #fff 99%, transparent),
            radial-gradient(1px 1px at 57% 63%, #30E0FF 99%, transparent),
            radial-gradient(1px 1px at 72% 22%, #FF50D0 99%, transparent),
            radial-gradient(2px 2px at 88% 47%, #fff 99%, transparent),
            radial-gradient(1px 1px at 15% 81%, #fff 99%, transparent),
            radial-gradient(1px 1px at 63% 91%, #FFE040 99%, transparent),
            radial-gradient(2px 2px at 94% 85%, #30E0FF 99%, transparent),
            #000;
          padding-top: 32px;
        }
        .tools-heading { color: #FFE040; font-size: 20px; letter-spacing: 3px; }
        .tools-subheading { color: #8A8AA8; }
        .tools-card {
          position: relative;
          border: 0;
          padding: 22px;
          background: #000;
          --frame: #30E0FF;
          clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 6px 6px);
          box-shadow: inset 0 0 0 4px var(--frame);
        }
        .tools-card:nth-of-type(3n+1) { --frame: #FF4040; }
        .tools-card:nth-of-type(3n+2) { --frame: #30E0FF; }
        .tools-card:nth-of-type(3n) { --frame: #FF50D0; }
        .tools-card-title { color: #FFE040; font-size: 13px; letter-spacing: 2px; }
        .tools-hint { color: #8A8AA8; }
        .tools .gem-modal-title,
        .tools .vod-label { color: #FFE040; }
        .tools-tab { border-color: #55557A; color: #8A8AA8; }
        .tools-tab:hover { color: #fff; border-color: #FFE040; }
        .tools-tab[aria-selected="true"] { color: #000; background: #FFE040; border-color: #FFE040; }
        .tools-tab:focus-visible,
        .vod-btn:focus-visible { outline-color: #FF4040; }
        .tools-tab-dot { background: #30E0FF; }
        .tools .vod-input { border-color: #30E0FF; }
        .tools .vod-input:focus-visible { border-color: #FFE040; }
        .tools .vod-btn { background: #000; border-color: #30E0FF; color: #fff; }
        .tools .vod-btn:hover:not(:disabled) { background: #30E0FF; color: #000; }
        .tools .vod-btn-primary:not(:disabled) { background: #FFE040; border-color: #FFE040; color: #000; }
        .tools .vod-btn-primary:hover:not(:disabled) { background: #fff; border-color: #fff; }
        .tools .gem-modal-opt.selected { background: #FFE040; color: #000; border-color: #FFE040; }
        .tools .vod-range,
        .tools .vod-check input { accent-color: #FFE040; }
        .tools .vod-panel.vod-panel-inline { border-color: #55557A; }
        .tools-clear-btn { background: #000; border-color: #FF4040; color: #FF4040; }
        .tools-clear-btn:hover { background: #FF4040; color: #000; }
        .tools .vod-error { color: #FF4040; }
        .tools-tracker-grid .item-btn.tools-picking { outline-color: #FFE040; }


        /* ===== Pop-ups (setup, gem count, start time) in the Arcade look ===== */
        .gem-modal-box {
          position: relative;
          border: 0;
          background: #000;
          box-shadow: inset 0 0 0 4px #30E0FF;
          clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 6px 6px);
          padding-top: 40px;
        }
        .gem-modal-box::before {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          top: 0;
          height: 9px;
          background: linear-gradient(180deg, #FF4040 0 2px, #000 2px 3px, #FF9020 3px 5px, #000 5px 6px, #FFE040 6px 8px, #000 8px);
        }
        .gem-modal-title { color: #FFE040; }
        .gem-modal-opt { background: #000; border-color: #30E0FF; }
        .gem-modal-opt:hover { background: #30E0FF; color: #000; }
        .gem-modal-opt.selected { background: #FFE040; border-color: #FFE040; color: #000; }
        .setup-checkbox input { border-color: #30E0FF; background: #000; }
        .setup-checkbox input:checked { background: #FFE040; border-color: #FFE040; }
        .setup-hint { color: #8A8AA8; }
        .timer-edit-btn { background: #FFE040; border-color: #FFE040; color: #000; }
        .timer-edit-btn:hover { background: #fff; border-color: #fff; color: #000; }

        /* Race info line under the two credit columns */
        .arcade-race-title {
          position: absolute;
          top: 752px;
          left: 728px;
          transform: translateX(-50%) scale(1.5);
          transform-origin: center;
          font-family: 'ZeldaII', monospace;
          font-size: 11px;
          letter-spacing: 1px;
          color: #FFE040;
          pointer-events: none;
          user-select: none;
        }
        .arcade-race-container {
          position: absolute;
          top: 768px;
          left: 448px;
          width: 560px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .arcade-race-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: #ffffff;
          font-family: 'ZeldaII', monospace;
          font-size: 15px;
          letter-spacing: 1px;
          text-align: center;
          text-transform: uppercase;
          caret-color: #FFE040;
        }
        .arcade-race-input::placeholder { color: rgba(255, 255, 255, 0.2); }

        /* ===== Arcade look for the 3- and 4-runner layouts: same grid, restyled ===== */
        .theme-arcade-multi { background: #000; }
        .theme-arcade-multi .quad-cell,
        .theme-arcade-multi .quad-side,
        .theme-arcade-multi .quad-rail { background: #000; }
        .theme-arcade-multi .quad-name {
          border: 0;
          outline: 0;
          background: transparent;
          border-bottom: 3px solid var(--pc, #FFE040);
          height: 36px;
        }
        .theme-arcade-multi .quad-name::before,
        .theme-arcade-multi .quad-name::after { display: none; }
        .theme-arcade-multi .quad-name .zelda-input { color: #fff; padding-left: 34px; padding-right: 26px; }
        .theme-arcade-multi .quad-name .series-pips { left: 4px; gap: 1px; }
        .theme-arcade-multi .quad-name .series-pip { width: 12px; height: 11px; }
        .theme-arcade-multi .quad-name .vod-audio { right: 3px; }
        .theme-arcade-multi .quad-name .vod-audio svg { width: 16px; height: 16px; }
        .theme-arcade-multi .quad-side-title { color: #FFE040; text-decoration: none; }
        .theme-arcade-multi .quad-side-info-input { border-color: #55557A; color: #FFE040; }
        .theme-arcade-multi .quad-rail-middle .quad-side-info { border-color: #55557A; }
        .theme-arcade-multi .quad-rail-middle .quad-side-info:focus-within { border-color: #FFE040; }

        /* Single commentator: collapse COM 2 and re-center the section */
        .single-com .commentary-title { top: 613px; }
        .single-com .commentary-container { top: 628px; height: 20px; }
        .single-com .tracking-title { top: 673px; }
        .single-com .tracking-container { top: 691px; }
        .single-com .timer-display { top: 732px; }

        /* ===== Arcade theme, 2 runners: same controls as Classic, moved and restyled ===== */
        .theme-arcade { background: #000; }
        .theme-arcade .transparent-overlay-left,
        .theme-arcade .transparent-overlay-right { display: none; }

        .arcade-decor { position: absolute; inset: 0; z-index: 0; pointer-events: none; }
        .arcade-decor > * { position: absolute; }
        .arcade-sky { left: 0; top: 0; opacity: 0.75; }
        .arcade-stripes {
          left: 0;
          width: 1456px;
          height: 9px;
          background: linear-gradient(180deg, #FF4040 0 2px, #000 2px 3px, #FF9020 3px 5px, #000 5px 6px, #FFE040 6px 8px, #000 8px);
        }
        .arcade-frame {
          background: var(--c);
          clip-path: polygon(6px 0, calc(100% - 6px) 0, calc(100% - 6px) 6px, 100% 6px, 100% calc(100% - 6px), calc(100% - 6px) calc(100% - 6px), calc(100% - 6px) 100%, 6px 100%, 6px calc(100% - 6px), 0 calc(100% - 6px), 0 6px, 6px 6px);
        }
        .arcade-frame-in {
          position: absolute;
          inset: 4px;
          background: #000;
          clip-path: polygon(4px 0, calc(100% - 4px) 0, calc(100% - 4px) 4px, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 4px calc(100% - 4px), 0 calc(100% - 4px), 0 4px, 4px 4px);
        }

        /* Name plates become the top HUD: player tag, series triforces, name, audio icon */
        .theme-arcade .text-box-left,
        .theme-arcade .text-box-right {
          top: 20px;
          width: 588px;
          height: 48px;
          background: transparent;
          box-shadow: none;
          justify-content: flex-start;
          z-index: 6;
        }
        .theme-arcade .text-box-left { left: 16px; }
        .theme-arcade .text-box-right { left: auto; right: 16px; }
        .theme-arcade .text-box-left::before,
        .theme-arcade .text-box-right::before {
          content: "1P";
          inset: auto;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          color: #FF4040;
          font-family: 'ZeldaII', monospace;
          font-size: 16px;
          line-height: 1;
        }
        .theme-arcade .text-box-right::before { content: "2P"; color: #30E0FF; }
        /* Row order: tag, name, music note, triforces (player 2 mirrored) */
        .theme-arcade .text-box-left .zelda-input,
        .theme-arcade .text-box-right .zelda-input { order: 1; flex: 1 1 auto; }
        .theme-arcade .text-box-left .vod-audio,
        .theme-arcade .text-box-right .vod-audio { order: 2; }
        .theme-arcade .text-box-left .series-pips,
        .theme-arcade .text-box-right .series-pips {
          order: 3;
          position: static;
          transform: none;
          flex: none;
          gap: 8px;
          /* Kept clear of the timer */
          margin: 0 24px 0 0;
        }
        .theme-arcade .text-box-right .series-pips { margin: 0 0 0 24px; }
        /* The music note stays put at the inner end, beside the triforces, however long the name is */
        .theme-arcade .text-box-left .vod-audio { margin: 0 30px 0 auto; }
        .theme-arcade .text-box-right .vod-audio { margin: 0 auto 0 30px; }
        .theme-arcade .text-box-left .series-pip,
        .theme-arcade .text-box-right .series-pip { width: 34px; height: 30px; }
        .theme-arcade .text-box-left .zelda-input,
        .theme-arcade .text-box-right .zelda-input {
          text-align: left;
          padding-left: 52px;
          color: #ffffff;
          line-height: 48px;
          font-size: var(--arcade-name-size, 24px);
          top: calc(var(--arcade-name-size, 24px) * -0.2);
        }

        /* Player 2 mirrors player 1: tag and triforces on the right, name right-aligned, audio icon on the left */
        .theme-arcade .text-box-right::before { left: auto; right: 0; }
        .theme-arcade .text-box-right .series-pips { flex-direction: row-reverse; }
        .theme-arcade .text-box-right .zelda-input { text-align: right; padding-left: 0; padding-right: 52px; }
        .theme-arcade .text-box-left .zelda-input,
        .theme-arcade .text-box-right .zelda-input {
          width: 100%;
          min-width: 0;
          flex: 1 1 auto;
        }
        .theme-arcade .text-box-left .vod-audio,
        .theme-arcade .text-box-right .vod-audio {
          position: static;
          transform: none;
          flex: none;
        }
        .theme-arcade .text-box-left .vod-audio svg,
        .theme-arcade .text-box-right .vod-audio svg { width: 30px; height: 30px; }
        .theme-arcade .text-box-right { flex-direction: row-reverse; }

        /* Place badge sits in the gap between the HUD and the game window */
        .theme-arcade .place-badge { transform: translate(-50%, -50%); z-index: 7; box-shadow: none; }

        /* Timer centred in the HUD */
        .theme-arcade .timer-display,
        .theme-arcade.single-com .timer-display {
          top: 22px;
          font-size: 32px;
          line-height: 1;
          text-align: center;
          filter: none;
        }

        /* Commentary and tracking as centred credits between the tracker boxes */
        .theme-arcade .center-panel-hitbox { top: 620px; left: 440px; width: 576px; height: 182px; }
        .theme-arcade .commentary-title,
        .theme-arcade .tracking-title { color: #FFE040; text-decoration: none; }
        /* Commentary on the left half, tracking on the right half, gem count below both */
        .theme-arcade .commentary-title,
        .theme-arcade.single-com .commentary-title { top: 646px; left: 584px; }
        .theme-arcade .commentary-container,
        .theme-arcade.single-com .commentary-container { top: 666px; left: 584px; }
        .theme-arcade.single-com .commentary-container { height: 20px; }
        .theme-arcade .tracking-title,
        .theme-arcade.single-com .tracking-title { top: 646px; left: 872px; }
        .theme-arcade .tracking-container,
        .theme-arcade.single-com .tracking-container { top: 666px; left: 872px; }

        /* Max Rando: race info shifts left and the gem and count sit side by side to its right */
        .theme-arcade .gem-image {
          top: 750px;
          left: 900px;
          transform: none;
          z-index: 6;
          filter: none;
        }
        .theme-arcade .gem-count {
          /* Gem is 44px tall from 750px (middle 772px); this font draws about 0.2em below its line's middle */
          top: 754px;
          line-height: 28px;
          left: 940px;
          transform: none;
          z-index: 6;
          font-size: 28px;
          letter-spacing: 0;
          filter: none;
        }
        .theme-arcade.max-rando .arcade-race-title { left: 664px; }
        .theme-arcade.max-rando .arcade-race-container { left: 448px; width: 432px; }

        /* Trackers fill the framed boxes under each game */
        .theme-arcade .boss-row,
        .theme-arcade .boss-row-right,
        .theme-arcade .item-row-1,
        .theme-arcade .item-row-2,
        .theme-arcade .item-row-3,
        .theme-arcade .item-row-1-right,
        .theme-arcade .item-row-2-right,
        .theme-arcade .item-row-3-right {
          width: 400px;
          justify-content: center;
          gap: 8px;
          z-index: 6;
        }
        .theme-arcade .boss-row,
        .theme-arcade .item-row-1,
        .theme-arcade .item-row-2,
        .theme-arcade .item-row-3 { left: 20px; }
        .theme-arcade .boss-row-right,
        .theme-arcade .item-row-1-right,
        .theme-arcade .item-row-2-right,
        .theme-arcade .item-row-3-right { left: auto; right: 20px; }
        .theme-arcade .boss-row,
        .theme-arcade .boss-row-right { top: 624px; gap: 12px; }
        .theme-arcade .item-row-1,
        .theme-arcade .item-row-1-right { top: 675px; }
        .theme-arcade .item-row-2,
        .theme-arcade .item-row-2-right { top: 717px; }
        .theme-arcade .item-row-3,
        .theme-arcade .item-row-3-right { top: 759px; }
        .theme-arcade .boss-btn img { width: 42px; height: 42px; }
        .theme-arcade .item-btn img { width: 40px; height: 40px; }
        .theme-arcade .boss-row::after,
        .theme-arcade .boss-row-right::after {
          content: "";
          position: absolute;
          left: 6%;
          right: 6%;
          bottom: -6px;
          height: 3px;
          background: repeating-linear-gradient(90deg, #FF4040 0 6px, transparent 6px 12px);
        }
        .theme-arcade .boss-row-right::after {
          background: repeating-linear-gradient(90deg, #30E0FF 0 6px, transparent 6px 12px);
        }
      `}</style>

      <div
        className={`overlay-wrapper${commentatorCount === 1 ? " single-com" : ""}${theme === "arcade" && runnerCount === 2 ? " theme-arcade" : ""}${theme === "arcade" && runnerCount !== 2 ? " theme-arcade-multi" : ""}${isMaxRando ? " max-rando" : ""}`}
        // CSS zoom, not a scale() transform: Twitch refuses play() inside a scaled-down transform
        // ("minimum requirements for autoplay were not met: style visibility")
        style={stageScale < 1 ? { zoom: stageScale } : undefined}
      >
        {runnerCount !== 2 && (
          <FourPlayerOverlay
            key={`${runnerCount}-${clearCount}`}
            ref={quadRef}
            layout={runnerCount === 3 ? TRIO_LAYOUT : QUAD_LAYOUT}
            arcade={theme === "arcade"}
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
            notDefeated={quadNotDefeated}
            notCollected={quadNotCollected}
            onToggleBoss={toggleQuadBoss}
            onToggleItem={toggleQuadItem}
            seriesWins={seriesWins}
            seriesToWin={seriesShown}
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
                  onMouseDown={(e) => e.button === 1 && e.preventDefault()}
                  onAuxClick={handleTimerMiddleClick}
                  onContextMenu={(e) => {
                    e.stopPropagation()
                    handleTimerRightClick(e)
                  }}
                  title="Click: start/pause/resume | Middle-click: reset to 0 | Right-click: edit start time"
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
            win={duoWindows[side]}
              config={vods[side]}
              layout={vodLayouts[side]}
              onAutoMute={() => updateVod(side, { muted: true })}
          />
        ))}

        {theme === "arcade" && <ArcadeDecor windows={duoWindows} />}

        {/* Background overlay image */}
        {theme === "classic" && <img
          src="/overlays/z2r-overlay-flush.png"
          alt="Zelda II Randomizer Restream Overlay"
          className="overlay-bg"
          draggable={false}
        />}

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
                  ? "The tools window was blocked. OBS browser sources can't open it: open this page in Chrome and use Window Capture instead. In a normal browser, allow popups and press OK again."
                  : "OK opens a separate tools window for loading, syncing and cropping videos, so viewers never see it."}
              </p>
              <button className="timer-edit-btn" onClick={confirmSetup} autoFocus>OK</button>
              {popupBlocked && (
                <button className="timer-edit-btn" style={{ marginLeft: 8 }} onClick={() => setSetupOpen(false)}>
                  Continue without tools
                </button>
              )}
            </div>
          </div>
        )}

        {runnerCount === 2 && (<>
        {/* Right-click an empty game window (or the frame around a loaded one) to set up that player's VOD.
            Nothing may cover a loaded VOD during playback, so the full-window hitbox only exists for empty windows. */}
        {(["left", "right"] as const).map((side) => {
          const win = duoWindows[side]
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

        {/* Race info, under commentary and tracking (Arcade only) */}
        {theme === "arcade" && (
          <>
            <div className="arcade-race-title">RACE INFO</div>
            <div className="arcade-race-container" onContextMenu={reopenSetup}>
              <input
                type="text"
                className="arcade-race-input"
                value={raceInfo}
                onChange={(e) => setRaceInfo(e.target.value)}
                placeholder="RACE INFO"
                aria-label="Race info"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
          </>
        )}

        {/* Timer */}
        <div
          className={`timer-display${timerPhase === 1 ? " running" : timerPhase === 2 ? " paused" : ""}`}
          onClick={handleTimerClick}
          onMouseDown={(e) => e.button === 1 && e.preventDefault()}
          onAuxClick={handleTimerMiddleClick}
          onContextMenu={handleTimerRightClick}
          title="Click: start/pause/resume | Middle-click: reset to 0 | Right-click: edit start time"
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
              <SeriesTools
                names={runnerCount === 2 ? [leftText, rightText] : Array.from({ length: runnerCount }, (_, i) => quadNames[i] ?? "")}
                wins={seriesWins}
                bestOf={seriesBestOf}
                onBestOfChange={changeSeriesBestOf}
                onChange={changeSeriesWins}
              />
              <RacetimeTools
                room={racetimeRoom}
                summary={racetimeSummary}
                error={racetimeError}
                busy={racetimeBusy}
                onImport={importRacetime}
                onUnlink={unlinkRacetime}
                onSwap={swapRacetimeRunners}
              />
              <RemoteTrackerTools
                code={trackerCode}
                sharing={trackerSharing}
                busy={trackerBusy}
                error={trackerError}
                count={trackerCount}
                onStart={() => startTrackerSharing()}
                onStop={stopTrackerSharing}
                onNewCode={makeNewTrackerCode}
              />
              <TrackerTools
                bosses={visibleBosses}
                items={ITEMS}
                bossBadges={bossBadges}
                bossBadgeLabels={BOSS_BADGES}
                itemBadges={itemBadges}
                onCycleBossBadge={cycleBadge}
                onClearBossBadge={clearBossBadge}
                onSetItemBadge={setItemBadge}
                badgeOptions={[CODE_OPTIONS, NUMBER_OPTIONS, LETTER_OPTIONS.filter((o) => !o.clear).map((o) => o.label)]}
              />
              {runnerCount === 2 ? (
                <PlayerTools
                  id="duo-tools"
                  players={(["left", "right"] as const).map((side) => ({
                    label: duoLabel(side),
                    config: vods[side],
                    onChange: (patch) => updateVod(side, patch),
                    playerRef: vodRefs[side],
                    cropTarget: duoWindows[side],
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
              <section className="tools-card" aria-labelledby="tools-clear-title">
                <h2 id="tools-clear-title" className="tools-card-title">Clear</h2>
                <button type="button" className="tools-clear-btn" onClick={clearOverlay}>
                  Clear overlay
                </button>
              </section>
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
          <SeriesPips wins={seriesWins[0]} toWin={seriesShown} />
          <input
            type="text"
            className="zelda-input"
            ref={leftNameRef}
            value={leftText}
            onChange={(e) => handleLeftTextChange(e.target.value)}
            placeholder="PLAYER 1"
            spellCheck={false}
            autoComplete="off"
            style={{ "--zelda-font-size": `${leftFontSize}px`, "--arcade-name-size": `${leftArcadeSize}px` } as React.CSSProperties}
          />
          {hasSource(vods.left) && (
            <AudioBadge
              playerName={duoLabel("left")}
              muted={vods.left.muted}
              onSelectAudio={() => setVods((prev) => ({ left: { ...prev.left, muted: false }, right: { ...prev.right, muted: true } }))}
            />
          )}
        </div>

        {/* Right editable text box */}
          <div
            className="text-box-right"
            onContextMenu={(e) => {
              if (hasSource(vods.right)) openVodPanel("right", e)
            }}
          >
          <SeriesPips wins={seriesWins[1]} toWin={seriesShown} />
          <input
            type="text"
            className="zelda-input"
            ref={rightNameRef}
            value={rightText}
            onChange={(e) => handleRightTextChange(e.target.value)}
            placeholder="PLAYER 2"
            spellCheck={false}
            autoComplete="off"
            style={{ "--zelda-font-size": `${rightFontSize}px`, "--arcade-name-size": `${rightArcadeSize}px` } as React.CSSProperties}
          />
          {hasSource(vods.right) && (
            <AudioBadge
              playerName={duoLabel("right")}
              muted={vods.right.muted}
              onSelectAudio={() => setVods((prev) => ({ left: { ...prev.left, muted: true }, right: { ...prev.right, muted: false } }))}
            />
          )}
        </div>

              <PlaceBadge place={placements[0]} win={theme === "arcade" ? { left: 524, top: 44, width: 0, height: 0 } : duoWindows.left} edge={theme === "arcade" ? "bottom" : "top"} />
              <PlaceBadge place={placements[1]} win={theme === "arcade" ? { left: 932, top: 44, width: 0, height: 0 } : duoWindows.right} edge={theme === "arcade" ? "bottom" : "top"} />

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
              onContextMenu={(e) => e.preventDefault()}
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
              onContextMenu={(e) => e.preventDefault()}
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
              onContextMenu={(e) => e.preventDefault()}
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
              onContextMenu={(e) => e.preventDefault()}
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
              onContextMenu={(e) => e.preventDefault()}
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
              onContextMenu={(e) => e.preventDefault()}
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
