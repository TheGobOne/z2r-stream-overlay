"use client"

import { useState, useRef, useEffect, useLayoutEffect } from "react"
import { VodPlayer, type VodPlayerHandle } from "@/components/vod-player"
import { AudioBadge } from "@/components/audio-badge"
import { SetupForm } from "@/components/setup-form"
import { assignPlace, PlaceBadge, type Place, type Placements } from "@/components/place-badge"
import { openToolsWindow, ToolsWindowPortal } from "@/components/tools-window"
import { FourPlayerOverlay, type QuadOverlayHandle } from "@/components/four-player-overlay"
import { SeriesPips } from "@/components/series-pips"
import type { StartingData } from "@/lib/starting-screen"
import { useChatCommands } from "@/lib/use-chat-commands"
import { hostTrackers, newJoinCode, TrackerLinkError, type TrackerAction, type TrackerHost, type TrackerSnapshot } from "@/lib/tracker-link"
import { fetchRace, parseRoom, type RacetimeRace, type RacetimeRunner } from "@/lib/racetime"
import { QUAD_LAYOUT, TRIO_LAYOUT } from "@/lib/quad"
import { BOSSES, ITEMS } from "@/lib/tracker-catalog"
import { ARCADE_WINDOWS, createVodConfig, restoreVodConfig, hasSource, resolveVodLayouts, VOD_WINDOWS, type VodConfig, type VodSide } from "@/lib/vod"
import { ArcadeDecor } from "@/components/arcade-decor"
import { useFitFontSize } from "@/lib/use-fit-font"
import "./overlay.css"
import { preload } from "react-dom"
import { ZELDA_FONT } from "@/lib/fonts"
import dynamic from "next/dynamic"

// Tools-window panels: loaded only when the popup opens, so OBS sources (which never open it) skip them
const ProgramMonitor = dynamic(() => import("@/components/program-monitor").then((m) => m.ProgramMonitor), { ssr: false })
const BoothLayout = dynamic(() => import("@/components/booth-layout").then((m) => m.BoothLayout), { ssr: false })
const TrackerTools = dynamic(() => import("@/components/tracker-tools").then((m) => m.TrackerTools), { ssr: false })
const RacetimeTools = dynamic(() => import("@/components/racetime-tools").then((m) => m.RacetimeTools), { ssr: false })
const SeriesTools = dynamic(() => import("@/components/series-tools").then((m) => m.SeriesTools), { ssr: false })
import { ChatHelp } from "@/components/chat-help"
const ChatCommandsTools = dynamic(() => import("@/components/chat-commands-tools").then((m) => m.ChatCommandsTools), { ssr: false })
const StartingScreenTools = dynamic(() => import("@/components/starting-screen-tools").then((m) => m.StartingScreenTools), { ssr: false })
const RemoteTrackerTools = dynamic(() => import("@/components/remote-tracker-tools").then((m) => m.RemoteTrackerTools), { ssr: false })
const PlayerTools = dynamic(() => import("@/components/player-tools").then((m) => m.PlayerTools), { ssr: false })

const STATE_STORAGE_KEY = "z2r-overlay-state"
const VOD_POSITIONS_KEY = "z2r-vod-positions"
const TIMER_STORAGE_KEY = "z2r-overlay-timer"


function formatTimer(ms: number): string {
  const negative = ms < 0
  const abs = Math.abs(ms)
  // Count down like a clock: -0.4 s still shows -0:00:01, and 0 never shows a minus sign
  const totalSec = negative ? Math.ceil(abs / 1000) : Math.floor(abs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${negative && totalSec > 0 ? "-" : ""}${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
}

/**
 * The race clock text. It ticks on its own so only this text re-renders each second, not the
 * whole overlay. `pausedMs` is the value while stopped or paused; while running it reads the refs.
 */
function TimerText({
  phase,
  pausedMs,
  accRef,
  startRef,
}: {
  phase: 0 | 1 | 2
  pausedMs: number
  accRef: { current: number }
  startRef: { current: number }
}) {
  const running = phase === 1
  // startRef is 0 for a moment around starting and stopping; show the stored time then
  const read = () => (running ? (startRef.current ? accRef.current + (Date.now() - startRef.current) : accRef.current) : pausedMs)
  const [text, setText] = useState(() => formatTimer(read()))
  // Layout effect: when racetime starts the clock from a timer callback, the right time paints in the same frame
  useLayoutEffect(() => {
    if (!running) return
    // Wake once per shown second, just after the displayed value changes
    let id = 0
    const tick = () => {
      const ms = read()
      setText(formatTimer(ms))
      const into = Math.abs(ms) % 1000
      id = window.setTimeout(tick, (ms >= 0 ? 1000 - into : into || 1000) + 5)
    }
    tick()
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])
  // Stopped or paused: straight from props, so pausing never paints a stale value
  return <>{running ? text : formatTimer(pausedMs)}</>
}

export default function StreamOverlay() {
  preload(ZELDA_FONT, { as: "font", type: "font/ttf", crossOrigin: "anonymous" })
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
  const [tracking2, setTracking2] = useState("")
  const [creditTrackers, setCreditTrackers] = useState<1 | 2>(1)
  const [isMaxRando, setIsMaxRando] = useState(false)
  // Arcade is the only look for now; the Classic brick art is still in the code for when it's wanted back
  const [theme] = useState<"classic" | "arcade">("arcade")
  const [draftCommentatorCount, setDraftCommentatorCount] = useState<1 | 2>(2)
  const [draftTrackerCount, setDraftTrackerCount] = useState<1 | 2>(1)
  const [draftMaxRando, setDraftMaxRando] = useState(false)
  const [runnerCount, setRunnerCount] = useState<2 | 3 | 4>(2)
  const [draftRunnerCount, setDraftRunnerCount] = useState<2 | 3 | 4>(2)
  /** 4 runners as two 1v1s (P1 vs P2 on top, P3 vs P4 below). */
  const [quadPairs, setQuadPairs] = useState(false)
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
    // The tools are rendered by this page, so they'd go dead while the overlay reloads. Blank them;
    // tools.html hands its window back to the reloaded page (below), or closes if the overlay is gone.
    const blankTools = () => {
      try {
        const doc = toolsWin.document
        const note = doc.createElement("p")
        note.textContent = "Overlay is reloading. The tools come back by themselves."
        note.style.cssText = "margin:24px;color:#8A8AA8;font:14px sans-serif"
        doc.body.replaceChildren(note)
      } catch {}
    }
    window.addEventListener("pagehide", blankTools)
    return () => {
      window.clearInterval(poll)
      window.removeEventListener("pagehide", blankTools)
    }
  }, [toolsWin])

  // Try to open the tools as soon as the site loads. Browsers only allow this once popups are allowed for the
  // site; otherwise it is blocked silently, Chrome shows its "popup blocked" icon, and OK on setup opens it.
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        const win = openToolsWindow(null)
        if (win) setToolsWin((prev) => (prev && !prev.closed ? prev : win))
      } catch {}
    }, 300)
    return () => window.clearTimeout(id)
  }, [])

  // A tools window left open across an overlay reload calls this to be rendered again (no click needed)
  useEffect(() => {
    const host = window as Window & { __z2rAttachTools?: (win: Window) => void }
    host.__z2rAttachTools = (win) => {
      if (!win.closed) setToolsWin((prev) => (prev && !prev.closed ? prev : win))
    }
    return () => {
      delete host.__z2rAttachTools
    }
  }, [])

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
  // Quad/trio videos live in FourPlayerOverlay; this copy is only for saving. The restored copy seeds the overlay once.
  const [quadVods, setQuadVods] = useState<VodConfig[]>([])
  const restoredQuadRef = useRef<{ count: number; names: string[]; vods: VodConfig[] } | null>(null)
  const toggleQuadBoss = (runner: number, id: string) => setQuadNotDefeated((prev) => toggleInRunner(prev, runner, id))
  const toggleQuadItem = (runner: number, id: string) => setQuadNotCollected((prev) => toggleInRunner(prev, runner, id))

  function applyRunnerCount(n: 2 | 3 | 4) {
    if (n !== runnerCount) {
      restoredQuadRef.current = null
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

  function applyTrackerCount(n: 1 | 2) {
    setCreditTrackers(n)
    setDraftTrackerCount(n)
    if (n === 1) setTracking2("")
  }

  function applyMaxRando(value: boolean) {
    setIsMaxRando(value)
    setDraftMaxRando(value)
  }

  function confirmSetup() {
    applyRunnerCount(draftRunnerCount)
    applyCommentatorCount(draftCommentatorCount)
    applyTrackerCount(draftTrackerCount)
    applyMaxRando(draftMaxRando)
    if (showTools()) setSetupOpen(false)
  }

  /** Right-clicks that used to reopen setup on the overlay now bring up the private tools window. */
  function reopenSetup(e: React.MouseEvent) {
    e.preventDefault()
    if (showTools()) return
    if (videosLoaded()) return warnNoTools()
    setDraftCommentatorCount(commentatorCount)
    setDraftTrackerCount(creditTrackers)
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
  const timerStartRef = useRef<number>(0)
  const timerAccRef = useRef<number>(0)
  const hydratedRef = useRef(false)

  useEffect(() => {
    if (timerPhase === 1) {
      timerStartRef.current = Date.now()
    } else {
      if (timerPhase === 2 && timerStartRef.current) {
        // Fold in the time since the last tick so pausing doesn't drop up to 100ms
        timerAccRef.current += Date.now() - timerStartRef.current
        timerStartRef.current = 0
        setTimerMs(timerAccRef.current)
      }
      if (timerPhase === 0) { timerAccRef.current = 0; timerStartRef.current = 0; setTimerMs(0) }
    }
    saveTimer()
  }, [timerPhase])

  /** Pass the phase when it was just set: this render's `timerPhase` is still the old one. */
  function saveTimer(phase: 0 | 1 | 2 = timerPhase) {
    if (!hydratedRef.current) return
    try {
      localStorage.setItem(
        TIMER_STORAGE_KEY,
        JSON.stringify({ phase, base: timerAccRef.current, startedAt: timerStartRef.current }),
      )
    } catch {}
  }

  function handleTimerClick() {
    // Left click toggles: stopped or paused -> running, running -> paused. Middle click resets.
    const next = timerPhase === 1 ? 2 : 1
    if (next === 2 && timerStartRef.current) {
      // Fold the running time in now, so the paused value renders together with the pause
      timerAccRef.current += Date.now() - timerStartRef.current
      timerStartRef.current = 0
      setTimerMs(timerAccRef.current)
    }
    setTimerPhase(next)
    if (linkVodsToTimer) {
      if (runnerCount !== 2) {
        if (next === 1) quadRef.current?.playAll()
        else quadRef.current?.pauseAll()
      } else if (next === 1) playBothVods()
      else pauseBothVods()
    }
  }

  const [resetArmed, setResetArmed] = useState(false)
  useEffect(() => {
    if (!resetArmed) return
    const id = window.setTimeout(() => setResetArmed(false), 3000)
    return () => window.clearTimeout(id)
  }, [resetArmed])

  function resetTimer() {
    // Clear here too: when already stopped, setTimerPhase(0) is a no-op and an edited start time would stay
    timerAccRef.current = 0
    timerStartRef.current = 0
    setTimerMs(0)
    setTimerPhase(0)
    saveTimer(0)
    if (linkVodsToTimer) resetVods()
  }

  function handleTimerMiddleClick(e: React.MouseEvent) {
    if (e.button !== 1) return
    e.preventDefault()
    resetTimer()
  }

  /** Right-click only opens the dialog; nothing changes until Set, so an accidental right-click mid-race is harmless. */
  function handleTimerRightClick(e: React.MouseEvent) {
    e.preventDefault()
    setTimerEditValue("")
    openOperatorPopup(() => setTimerEditOpen(true))
  }

  /** Popups open in the tools window (opened or brought forward by this click), never over the live stage. */
  function openOperatorPopup(open: () => void) {
    if (!showTools() && videosLoaded()) return warnNoTools()
    open()
  }

  /** On the stage, a dialog's full-screen backdrop would cover the Twitch players and Twitch pauses them on air. */
  function videosLoaded() {
    return runnerCount === 2 ? hasSource(vods.left) || hasSource(vods.right) : quadVods.some(hasSource)
  }
  function warnNoTools() {
    window.alert("The tools window was blocked, and a dialog here would pause the videos on stream. Allow popups for this site, then try again.")
  }


  function applyTimerEdit() {
    const ms = parseTimerInput(timerEditValue)
    if (ms === null) return
    timerAccRef.current = ms
    setTimerMs(ms)
    if (timerPhase === 1) {
      // A correction mid-race: the clock keeps running from the new time and the videos keep playing
      timerStartRef.current = Date.now()
      saveTimer(1)
    } else {
      // Stopped or paused: the edited time waits for the next click to start, with linked videos at their start
      timerStartRef.current = 0
      saveTimer(timerPhase)
      if (linkVodsToTimer) resetVods()
    }
    setTimerEditOpen(false)
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
  // Index = overlay slot; a hole means that slot has no racetime runner (after a slot swap)
  const racetimeRunnersRef = useRef<(RacetimeRunner | undefined)[]>([])
  const racetimeEndedRef = useRef(false)
  /** The linked room and its slot order, so an OBS refresh keeps polling instead of unlinking mid-race. */
  const RACETIME_KEY = "z2r-racetime"
  function saveRacetime(room: string | null) {
    try {
      if (!room) localStorage.removeItem(RACETIME_KEY)
      else
        localStorage.setItem(
          RACETIME_KEY,
          JSON.stringify({ room, runners: racetimeRunnersRef.current.map((r) => r ?? null), ended: racetimeEndedRef.current }),
        )
    } catch {}
  }
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

  function applyRunners(runners: (RacetimeRunner | undefined)[]) {
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
      quadRef.current?.setRunners(runners.map((r) => (r ? { name: r.name, channel: r.channel } : undefined)))
    }
  }

  /** Sets each runner's place badge from racetime: their place when done, DNF when they forfeit or are disqualified. */
  function syncPlaces(race: RacetimeRace) {
    const order = racetimeRunnersRef.current
    order.forEach((known, index) => {
      if (!known || index >= runnerCount) return
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
      // The winner's time (ended_at is when the last entrant finished or forfeited). Cancelled during
      // the countdown: cancelled_at is before the start, so clamp to 0
      const final = Math.max(0, (race.winnerMs ?? race.endMs) - race.startMs)
      timerAccRef.current = final
      timerStartRef.current = 0
      setTimerMs(final)
      setTimerPhase(2)
      saveTimer(2)
      saveRacetime(race.room)
      return
    }
    racetimeEndedRef.current = false
    const elapsed = now - race.startMs
    // Start the timer once when racetime starts the race; after that a manual pause or reset sticks
    const justStarted = !racetimeRunningRef.current
    racetimeRunningRef.current = true
    if (timerPhaseRef.current !== 1) {
      if (!justStarted) return
      timerAccRef.current = elapsed
      setTimerPhase(1)
      if (linkVodsToTimer) {
        if (runnerCount !== 2) quadRef.current?.playAll()
        else playBothVods()
      }
    } else if (Math.abs(timerAccRef.current + (now - timerStartRef.current) - elapsed) > 1000) {
      timerAccRef.current = elapsed
      timerStartRef.current = now
      saveTimer(1)
    }
  }
  /** Set once this room has been seen running, so the timer is only auto-started the first time. */
  const racetimeRunningRef = useRef(false)
  const syncRaceRef = useRef(syncRace)
  syncRaceRef.current = syncRace
  const applyRunnersRef = useRef(applyRunners)
  applyRunnersRef.current = applyRunners
  /** A room imported while the layout had too few slots; applied after the bigger layout renders. */
  const pendingImportRef = useRef<RacetimeRace | null>(null)
  useEffect(() => {
    const race = pendingImportRef.current
    if (!race) return
    pendingImportRef.current = null
    applyRunnersRef.current(race.runners)
    syncRaceRef.current(race)
  }, [runnerCount])

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
      racetimeRunningRef.current = false
      racetimePlacesRef.current = {}
      setRacetimeRoom(room)
      saveRacetime(room)
      // More racers than the current layout holds: grow to 3 or 4 runners, then fill it once it mounts
      const wanted = Math.min(4, race.runners.length)
      if (wanted >= 3 && wanted > runnerCount) {
        pendingImportRef.current = race
        applyRunnerCount(wanted as 3 | 4)
        return
      }
      const wasRunning = timerPhaseRef.current === 1
      applyRunners(race.runners)
      syncRace(race)
      // Re-importing mid-race reloads the live channels; with the clock already running nothing else restarts them
      if (wasRunning && linkVodsToTimer && race.startMs !== null && race.endMs === null) {
        if (runnerCount !== 2) quadRef.current?.playAll()
        else playBothVods()
      }
    } catch (error) {
      setRacetimeError(error instanceof Error ? error.message : "Could not import that room")
    } finally {
      setRacetimeBusy(false)
    }
  }

  /** The quad overlay moved runners between slots: order[slot] is the runner (old slot) now there. */
  function arrangeQuadRunners(order: number[]) {
    const reorder = <T,>(list: T[]) => [...order.map((r) => list[r]), ...list.slice(order.length)]
    setQuadNotDefeated(reorder)
    setQuadNotCollected(reorder)
    setPlacements((prev) => reorder(prev))
    setSeriesWins((prev) => {
      const next = reorder(prev)
      saveSeries(seriesBestOf, next)
      return next
    })
    const known = racetimeRunnersRef.current
    if (known.length > 0) {
      racetimeRunnersRef.current = reorder(Array.from({ length: Math.max(known.length, order.length) }, (_, i) => known[i]))
      saveRacetime(racetimeRoom)
    }
  }

  /** 2 runners: trade sides completely (name, video, trackers, place, series wins), not just the names. */
  function swapRacetimeRunners() {
    const known = racetimeRunnersRef.current
    racetimeRunnersRef.current = [known[1], known[0], ...known.slice(2)]
    saveRacetime(racetimeRoom)
    const [l, r] = [leftText, rightText]
    handleLeftTextChange(r)
    handleRightTextChange(l)
    const [ld, rd, lc, rc] = [leftDefeated, rightDefeated, leftCollected, rightCollected]
    setLeftDefeated(rd)
    setRightDefeated(ld)
    setLeftCollected(rc)
    setRightCollected(lc)
    // A VOD picks up where it was (resumeSeconds) and keeps its start point for resets
    const resume = (config: VodConfig, time: number | null | undefined) =>
      config.videoId && time != null ? { ...config, resumeSeconds: Math.floor(time) } : config
    const leftTime = leftVodRef.current?.getCurrentTime()
    const rightTime = rightVodRef.current?.getCurrentTime()
    const [leftPlaying, rightPlaying] = [leftVodRef.current, rightVodRef.current].map((p) => p != null && !p.isPaused())
    setVods((prev) => ({ left: resume(prev.right, rightTime), right: resume(prev.left, leftTime) }))
    // Both players reload; a play asked for now carries over to the new player (PLAY_CARRY_MS)
    if (rightPlaying) leftVodRef.current?.play()
    if (leftPlaying) rightVodRef.current?.play()
    setPlacements((prev) => [prev[1], prev[0], ...prev.slice(2)])
    setSeriesWins((prev) => {
      const next = [prev[1], prev[0], ...prev.slice(2)]
      saveSeries(seriesBestOf, next)
      return next
    })
  }

  function unlinkRacetime() {
    setRacetimeRoom(null)
    saveRacetime(null)
    setRacetimeSummary("")
    setRacetimeError("")
  }

  useEffect(() => {
    if (!racetimeRoom) return
    let stopped = false
    // A chain, not an interval: a slow reply can't overlap the next request and land out of order
    let poll = 0
    const tick = async () => {
      try {
        const race = await fetchRace(racetimeRoom)
        if (stopped) return
        setRacetimeError("")
        syncRaceRef.current(race)
        // Finished or cancelled: places and the clock won't change again
        if (race.over) return
      } catch (error) {
        if (!stopped) setRacetimeError(error instanceof Error ? error.message : "Lost the connection to racetime.gg")
      }
      if (!stopped) poll = window.setTimeout(tick, 5000)
    }
    poll = window.setTimeout(tick, 5000)
    return () => {
      stopped = true
      window.clearTimeout(poll)
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
  const LETTER_OPTIONS: { label: string; clear?: boolean }[] = [
    { label: "W" },
    { label: "E" },
    { label: "MI" },
    { label: "DM" },
    { label: "", clear: true },
  ]
  /** Badge choices offered for an item, one row per kind; also what remote trackers may send. */
  const BADGE_OPTIONS = [CODE_OPTIONS, NUMBER_OPTIONS, LETTER_OPTIONS.filter((o) => !o.clear).map((o) => o.label)]

  // Badge values keyed by item id, per side
  const [itemBadges, setItemBadges] = useState<Record<string, string>>({})

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
    setQuadNotDefeated(freshQuadSets(BOSSES.map((b) => b.id)))
    setQuadNotCollected(freshQuadSets(ITEMS.map((i) => i.id)))
    setMarkedOff(new Set())
    setMarkedBossesOff(new Set())
  }

  /** Resets everything per-race; runner/commentator counts and Max Rando stay as set up. */
  function clearOverlay() {
    if (!(toolsWin ?? window).confirm("Clear names, videos, timer, badges and tracker icons? The series score stays.")) return
    pauseBothVods()
    quadRef.current?.pauseAll()
    setLeftText("")
    setRightText("")
    setCommentator1("")
    setCommentator2("")
    setTracking("")
    setTracking2("")
    setRaceInfo("")
    setGemCount(null)
    setLeftDefeated(new Set(BOSSES.map((b) => b.id)))
    setRightDefeated(new Set(BOSSES.map((b) => b.id)))
    setLeftCollected(new Set(ITEMS.map((i) => i.id)))
    setRightCollected(new Set(ITEMS.map((i) => i.id)))
    setBossBadges({})
    setItemBadges({})
    setPlacements(Array(4).fill(null))
    restoredQuadRef.current = null
    setQuadNames([])
    setQuadNotDefeated(freshQuadSets(BOSSES.map((b) => b.id)))
    setQuadNotCollected(freshQuadSets(ITEMS.map((i) => i.id)))
    setMarkedOff(new Set())
    setMarkedBossesOff(new Set())
    // The series score stays: clearing between games of a best-of must keep it (Series score panel resets it)
    setVods({ left: createVodConfig(), right: createVodConfig() })
    setClearCount((n) => n + 1)
    setTimerPhase(0)
    timerAccRef.current = 0
    timerStartRef.current = 0
    setTimerMs(0)
    saveTimer(0)
  }


  // Remote trackers: other people mark items and bosses from their own browser with a join code
  const TRACKER_CODE_KEY = "z2r-tracker-code"
  /** Set while sharing, so a reload of the overlay picks sharing back up and shared links keep working. */
  const TRACKER_SHARING_KEY = "z2r-tracker-sharing"
  const [trackerCode, setTrackerCode] = useState("")
  const [trackerSharing, setTrackerSharing] = useState(false)
  const [trackerBusy, setTrackerBusy] = useState(false)
  const [trackerError, setTrackerError] = useState("")
  const [trackerCount, setTrackerCount] = useState(0)
  const trackerHostRef = useRef<TrackerHost | null>(null)
  /** The starting screen's text, reported by its Booth panel and sent to the OBS starting screen with every snapshot. */
  const [startingData, setStartingData] = useState<StartingData | null>(null)

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
    let resume = false
    try {
      resume = localStorage.getItem(TRACKER_SHARING_KEY) === "1"
    } catch {}
    // A tick later, so dev StrictMode's throwaway first mount cancels it instead of claiming the code twice
    const resumeTimer = resume ? window.setTimeout(() => void startTrackerSharing(code, true), 0) : undefined
    return () => window.clearTimeout(resumeTimer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Copying every tracker Set is only worth it while someone can receive the snapshot
  const trackerRunners: TrackerSnapshot["runners"] = !trackerSharing
    ? []
    : runnerCount === 2
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
    badgeOptions: BADGE_OPTIONS,
    ...(startingData ? { starting: startingData } : {}),
  }
  // Nobody reads it while sharing is off, so skip the work
  const trackerSnapshotJson = trackerSharing ? JSON.stringify(trackerSnapshot) : ""
  useEffect(() => {
    if (trackerSnapshotJson) trackerHostRef.current?.broadcast(trackerSnapshot)
    // trackerSnapshotJson changes exactly when the snapshot does
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackerSnapshotJson, trackerSharing])

  /** Anyone holding the join code can send anything, so only well-formed actions on known ids get through. */
  function isValidTrackerAction(action: unknown): action is TrackerAction {
    if (!action || typeof action !== "object") return false
    const a = action as Record<string, unknown>
    const isBoss = typeof a.id === "string" && BOSSES.some((boss) => boss.id === a.id)
    const isItem = typeof a.id === "string" && ITEMS.some((item) => item.id === a.id)
    const runnerOk = typeof a.runner === "number" && Number.isInteger(a.runner) && a.runner >= 0 && a.runner < runnerCount
    switch (a.type) {
      case "toggleBoss":
        return isBoss && runnerOk && (a.greyed === undefined || typeof a.greyed === "boolean")
      case "toggleItem":
        return isItem && runnerOk && (a.greyed === undefined || typeof a.greyed === "boolean")
      case "cycleBossBadge":
      case "clearBossBadge":
        return isBoss
      case "setBossBadge":
        return isBoss && (a.value === null || (Number.isInteger(a.value) && (a.value as number) >= 0 && (a.value as number) < BOSS_BADGES.length))
      case "setItemBadge":
        return isItem && (a.value === null || (typeof a.value === "string" && BADGE_OPTIONS.some((row) => row.includes(a.value as string))))
      default:
        return false
    }
  }

  const trackerActionRef = useRef<(action: TrackerAction) => void>(() => {})
  trackerActionRef.current = (action) => {
    if (!isValidTrackerAction(action)) return
    if (action.type === "cycleBossBadge" || action.type === "clearBossBadge") {
      return action.type === "cycleBossBadge" ? cycleBadge(action.id) : clearBossBadge(action.id)
    }
    if (action.type === "setItemBadge") return setItemBadge(action.id, action.value)
    if (action.type === "setBossBadge") {
      const { id, value } = action
      return setBossBadges((prev) => {
        const next = { ...prev }
        if (value === null) delete next[id]
        else next[id] = value
        return next
      })
    }
    const { type, runner, id, greyed } = action
    // `greyed` says what the helper wants. It's checked inside the state updater, against the latest
    // state, so two helpers (or a laggy double click) asking for the same thing can't cancel out.
    if (greyed !== undefined) {
      const setTo = (prev: Set<string>) => {
        if (prev.has(id) === greyed) return prev
        const next = new Set(prev)
        if (greyed) next.add(id)
        else next.delete(id)
        return next
      }
      if (runnerCount === 2) {
        const setter =
          type === "toggleBoss" ? (runner === 0 ? setLeftDefeated : setRightDefeated) : runner === 0 ? setLeftCollected : setRightCollected
        setter(setTo)
      } else {
        const setter = type === "toggleBoss" ? setQuadNotDefeated : setQuadNotCollected
        setter((prev) => {
          const current = prev[runner] ?? new Set<string>()
          const next = setTo(current)
          return next === current ? prev : prev.map((set, i) => (i === runner ? next : set))
        })
      }
      return
    }
    if (runnerCount === 2) {
      if (type === "toggleBoss") (runner === 0 ? toggleLeftBoss : toggleRightBoss)(id)
      else (runner === 0 ? toggleLeftItem : toggleRightItem)(id)
    } else if (type === "toggleBoss") toggleQuadBoss(runner, id)
    else toggleQuadItem(runner, id)
  }

  // Chat commands run the same actions remote trackers send
  const chat = useChatCommands(runnerCount, (action) => {
    if (action.type === "audio") {
      // Sound on one player, muting the others, like clicking its audio badge
      if (runnerCount === 2) {
        setVods((prev) => ({ left: { ...prev.left, muted: action.runner !== 0 }, right: { ...prev.right, muted: action.runner !== 1 } }))
      } else quadRef.current?.listenTo(action.runner)
      return
    }
    if (action.type !== "toggleItemLocation") return trackerActionRef.current(action)
    // The same location sent again clears it
    setItemBadges((prev) => {
      const next = { ...prev }
      if (next[action.id] === action.value) delete next[action.id]
      else next[action.id] = action.value
      return next
    })
  })

  const RESUME_RETRY_ERRORS =new Set(["unavailable-id", "network", "server-error", "socket-error", "socket-closed"])
  // Each start gets a number; stopping or a newer start bumps it, so a start that finishes late is thrown away
  const shareGenRef = useRef(0)
  const shareBusyRef = useRef(false)

  /** `resume`: after a reload the old session can hold the code for up to a minute, so keep trying. */
  async function startTrackerSharing(code = trackerCode, resume = false) {
    if (!code || shareBusyRef.current) return
    const gen = ++shareGenRef.current
    shareBusyRef.current = true
    setTrackerBusy(true)
    setTrackerError("")
    const giveUpAt = Date.now() + (resume ? 90_000 : 0)
    try {
      for (;;) {
        try {
          const onCount = (n: number) => {
            if (gen === shareGenRef.current) setTrackerCount(n)
          }
          const host = await hostTrackers(code, (action) => trackerActionRef.current(action), onCount, (message) => {
            if (trackerHostRef.current !== host) return
            trackerHostRef.current = null
            setTrackerSharing(false)
            setTrackerError(message)
          })
          if (gen !== shareGenRef.current) {
            host.stop()
            return
          }
          trackerHostRef.current = host
          setTrackerSharing(true)
          setTrackerError("")
          try {
            localStorage.setItem(TRACKER_SHARING_KEY, "1")
          } catch {}
          return
        } catch (error) {
          if (gen !== shareGenRef.current) return
          // On resume, also wait out a network that isn't up yet (OBS can load before Wi-Fi connects)
          if (error instanceof TrackerLinkError && RESUME_RETRY_ERRORS.has(error.type) && Date.now() < giveUpAt) {
            setTrackerError(
              error.type === "unavailable-id"
                ? "Waiting for the previous session to release this code..."
                : "Waiting for the connection service...",
            )
            await new Promise((r) => window.setTimeout(r, 5000))
            if (gen !== shareGenRef.current) return
            continue
          }
          setTrackerError(error instanceof Error ? error.message : "Could not start sharing")
          return
        }
      }
    } finally {
      if (gen === shareGenRef.current) {
        shareBusyRef.current = false
        setTrackerBusy(false)
      }
    }
  }

  function stopTrackerSharing() {
    shareGenRef.current++
    setTrackerCount(0)
    setTrackerError("")
    shareBusyRef.current = false
    setTrackerBusy(false)
    trackerHostRef.current?.stop()
    trackerHostRef.current = null
    setTrackerSharing(false)
    try {
      localStorage.removeItem(TRACKER_SHARING_KEY)
    } catch {}
  }

  function makeNewTrackerCode() {
    const code = newJoinCode()
    try {
      localStorage.setItem(TRACKER_CODE_KEY, code)
    } catch {}
    setTrackerCode(code)
    if (trackerSharing || shareBusyRef.current) {
      stopTrackerSharing()
      void startTrackerSharing(code)
    }
  }

  useEffect(
    () => () => {
      shareGenRef.current++
      shareBusyRef.current = false
      trackerHostRef.current?.stop()
    },
    [],
  )

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
      const savedTimer = JSON.parse(localStorage.getItem(TIMER_STORAGE_KEY) ?? "null")
      const timerRunning = savedTimer?.phase === 1 && Number.isFinite(savedTimer?.startedAt)
      // VODs pick up where they were; a linked one that was playing also moved on with the restored clock
      const positions = JSON.parse(localStorage.getItem(VOD_POSITIONS_KEY) ?? "null")
      const resumeAt = (config: VodConfig, i: number): VodConfig => {
        const p = Array.isArray(positions?.list) ? positions.list[i] : null
        if (!config.videoId || !p || p.id !== config.videoId || !Number.isFinite(p.t) || !Number.isFinite(positions.at)) return config
        const ran = p.playing === true && timerRunning && saved?.linkVodsToTimer === true ? (Date.now() - positions.at) / 1000 : 0
        return { ...config, resumeSeconds: Math.max(0, Math.floor(p.t + ran)) }
      }
      if (saved) {
        if (typeof saved.leftText === "string") handleLeftTextChange(saved.leftText)
        if (typeof saved.rightText === "string") handleRightTextChange(saved.rightText)
        if (typeof saved.commentator1 === "string") setCommentator1(saved.commentator1)
        if (typeof saved.commentator2 === "string") setCommentator2(saved.commentator2)
        if (typeof saved.tracking === "string") setTracking(saved.tracking)
        if (typeof saved.tracking2 === "string") setTracking2(saved.tracking2)
        if (saved.creditTrackers === 1 || saved.creditTrackers === 2) {
          setCreditTrackers(saved.creditTrackers)
          setDraftTrackerCount(saved.creditTrackers)
        }
        if (typeof saved.raceInfo === "string") setRaceInfo(saved.raceInfo)
        if (typeof saved.gemCount === "number") setGemCount(saved.gemCount)
        if (saved.runnerCount === 2 || saved.runnerCount === 3 || saved.runnerCount === 4) {
          setRunnerCount(saved.runnerCount)
          setDraftRunnerCount(saved.runnerCount)
        }
        if (typeof saved.quadPairs === "boolean") setQuadPairs(saved.quadPairs)
        if (saved.commentatorCount === 1 || saved.commentatorCount === 2) {
          setCommentatorCount(saved.commentatorCount)
          setDraftCommentatorCount(saved.commentatorCount)
        }
        if (typeof saved.isMaxRando === "boolean") {
          setIsMaxRando(saved.isMaxRando)
          setDraftMaxRando(saved.isMaxRando)
        }
        const bossIds = (list: unknown) => new Set((Array.isArray(list) ? list : []).filter((id) => BOSSES.some((b) => b.id === id)) as string[])
        const itemIds = (list: unknown) => new Set((Array.isArray(list) ? list : []).filter((id) => ITEMS.some((i) => i.id === id)) as string[])
        if (Array.isArray(saved.leftDefeated)) setLeftDefeated(bossIds(saved.leftDefeated))
        if (Array.isArray(saved.rightDefeated)) setRightDefeated(bossIds(saved.rightDefeated))
        if (Array.isArray(saved.leftCollected)) setLeftCollected(itemIds(saved.leftCollected))
        if (Array.isArray(saved.rightCollected)) setRightCollected(itemIds(saved.rightCollected))
        // Saved data may be old or hand-edited; bad values would make every remote tracker reject the state
        if (saved.bossBadges && typeof saved.bossBadges === "object") {
          setBossBadges(Object.fromEntries(Object.entries(saved.bossBadges).filter(([id, n]) =>
            BOSSES.some((boss) => boss.id === id) && Number.isInteger(n) && (n as number) >= 0 && (n as number) < BOSS_BADGES.length)) as Record<string, number>)
        }
        if (saved.itemBadges && typeof saved.itemBadges === "object") {
          setItemBadges(Object.fromEntries(Object.entries(saved.itemBadges).filter(([id, v]) =>
            ITEMS.some((item) => item.id === id) && typeof v === "string")) as Record<string, string>)
        }
        if (Array.isArray(saved.placements)) {
          const valid = (p: unknown): p is Place => p === "dnf" || p === 1 || p === 2 || p === 3 || p === 4
          setPlacements(Array.from({ length: 4 }, (_, i) => (valid(saved.placements[i]) ? saved.placements[i] : null)))
        }
        if (saved.vods?.left && saved.vods?.right) {
          setVods({ left: resumeAt(restoreVodConfig(saved.vods.left), 0), right: resumeAt(restoreVodConfig(saved.vods.right), 1) })
        }
        if (typeof saved.linkVodsToTimer === "boolean") setLinkVodsToTimer(saved.linkVodsToTimer)
        // A reload (OBS refresh, crash) must not put the setup dialog over the stream; right-click reopens tools
        setSetupOpen(false)
        const quad = saved.quad
        if (quad && quad.count === saved.runnerCount && quad.count !== 2) {
          const strings = (list: unknown) => (Array.isArray(list) ? list.filter((v): v is string => typeof v === "string") : [])
          // Only ids the catalog knows, like the 2-runner restore; stale ids would ride along in every snapshot
          const sets = (list: unknown, known: string[]) =>
            Array.from({ length: 4 }, (_, i) =>
              Array.isArray(list) && Array.isArray(list[i]) ? new Set(strings(list[i]).filter((id) => known.includes(id))) : new Set(known),
            )
          const names = strings(quad.names)
          const vods: VodConfig[] = Array.isArray(quad.vods)
            ? quad.vods.map((v: unknown, i: number) => resumeAt(restoreVodConfig(v), i))
            : []
          restoredQuadRef.current = { count: quad.count, names, vods }
          setQuadNames(names)
          setQuadNotDefeated(sets(quad.notDefeated, BOSSES.map((b) => b.id)))
          setQuadNotCollected(sets(quad.notCollected, ITEMS.map((i) => i.id)))
        }
      }
      const timer = savedTimer
      if (timer && Number.isFinite(timer.base)) {
        const running = timer.phase === 1 && timer.startedAt
        const ms = running ? timer.base + (Date.now() - timer.startedAt) : timer.base
        timerAccRef.current = ms
        setTimerMs(ms)
        if (timer.phase === 1 || timer.phase === 2) setTimerPhase(timer.phase)
        if (timer.phase === 1) resumeVodsRef.current = true
      }
      // Keep polling the linked racetime room, so places and the final time still arrive after a refresh
      const rt = JSON.parse(localStorage.getItem(RACETIME_KEY) ?? "null")
      if (rt && typeof rt.room === "string" && parseRoom(rt.room) === rt.room && Array.isArray(rt.runners)) {
        racetimeRunnersRef.current = rt.runners.slice(0, 4).map((r: unknown) => {
          const v = r as Record<string, unknown> | null
          return v && typeof v.name === "string"
            ? { name: v.name, channel: typeof v.channel === "string" ? v.channel : null, status: "", place: null, finishedAt: null }
            : undefined
        })
        racetimeEndedRef.current = rt.ended === true
        // A clock already in use was started by racetime (or by hand); the first poll must not restart it
        racetimeRunningRef.current = timer?.phase === 1 || timer?.phase === 2
        setRacetimeRoom(rt.room)
      }
    } catch {}
    hydratedRef.current = true
    setHydrated(true)
    // Dev StrictMode re-runs effects; without this the timer effect's re-run would save a zeroed timer first
    return () => {
      hydratedRef.current = false
    }
  }, [])

  // Where each VOD is, every 10 s and on pagehide, so a refresh or crash resumes there instead of at the start
  const savePositionsRef = useRef<() => void>(() => {})
  savePositionsRef.current = () => {
    if (!hydratedRef.current) return
    const players = runnerCount === 2 ? [leftVodRef.current, rightVodRef.current] : (quadRef.current?.players() ?? [])
    const configs = runnerCount === 2 ? [vods.left, vods.right] : quadVods
    try {
      const old = JSON.parse(localStorage.getItem(VOD_POSITIONS_KEY) ?? "null")
      const list = configs.map((config, i) => {
        const t = players[i]?.getCurrentTime() ?? null
        if (config?.videoId && t !== null) return { id: config.videoId, t, playing: !players[i]!.isPaused() }
        // A player still loading keeps the last known spot for the same video
        const prev = Array.isArray(old?.list) ? old.list[i] : null
        return config?.videoId && prev?.id === config.videoId ? prev : null
      })
      localStorage.setItem(VOD_POSITIONS_KEY, JSON.stringify({ at: Date.now(), list }))
    } catch {}
  }
  useEffect(() => {
    const save = () => savePositionsRef.current()
    const id = window.setInterval(save, 10_000)
    window.addEventListener("pagehide", save)
    return () => {
      window.clearInterval(id)
      window.removeEventListener("pagehide", save)
    }
  }, [])

  // Saving serializes everything, so wait for a pause in typing; pagehide flushes the last change
  const pendingSaveRef = useRef<(() => void) | null>(null)
  useEffect(() => {
    const flush = () => pendingSaveRef.current?.()
    window.addEventListener("pagehide", flush)
    return () => {
      window.removeEventListener("pagehide", flush)
      flush()
    }
  }, [])
  useEffect(() => {
    if (!hydrated) return
    const save = () => {
      pendingSaveRef.current = null
    try {
      localStorage.setItem(
        STATE_STORAGE_KEY,
        JSON.stringify({
          leftText, rightText, commentator1, commentator2, tracking, tracking2, raceInfo, gemCount,
          runnerCount, quadPairs, commentatorCount, creditTrackers, isMaxRando,
          leftDefeated: [...leftDefeated], rightDefeated: [...rightDefeated],
          leftCollected: [...leftCollected], rightCollected: [...rightCollected],
          bossBadges, itemBadges, placements, vods, linkVodsToTimer,
          quad: runnerCount === 2 ? null : {
            count: runnerCount, names: quadNames, vods: quadVods,
            notDefeated: quadNotDefeated.map((set) => [...set]),
            notCollected: quadNotCollected.map((set) => [...set]),
          },
        }),
      )
    } catch {}
    }
    pendingSaveRef.current = save
    const id = window.setTimeout(save, 300)
    return () => window.clearTimeout(id)
  }, [
    hydrated, leftText, rightText, commentator1, commentator2, tracking, tracking2, raceInfo, gemCount,
    runnerCount, quadPairs, commentatorCount, creditTrackers, isMaxRando, leftDefeated, rightDefeated, leftCollected, rightCollected,
    bossBadges, itemBadges, placements, vods, linkVodsToTimer,
    quadNames, quadVods, quadNotDefeated, quadNotCollected,
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
  /** Keeps Tab inside a modal box, so it can't reach (and Space press) controls behind the backdrop. */
  function trapTab(e: React.KeyboardEvent, box: HTMLElement | null) {
    if (e.key !== "Tab" || !box) return
    const focusable = box.querySelectorAll<HTMLElement>("button:not(:disabled), input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])")
    if (!focusable.length) return
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = box.ownerDocument.activeElement
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus() }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus() }
  }
  function handleSetupKeyDown(e: React.KeyboardEvent) {
    // Enter on a field confirms; on a button or link it must do that control's own action
    const tag = (e.target as HTMLElement).tagName
    if (e.key === "Enter" && (tag === "INPUT" || tag === "SELECT")) return confirmSetup()
    if (e.key === "Escape") return setSetupOpen(false)
    trapTab(e, setupBoxRef.current)
  }
  const timerEditBoxRef = useRef<HTMLDivElement>(null)

  // Operator popups. With the tools window open they render there, so viewers never see them
  // and nothing covers a live Twitch player on the overlay.
  const operatorPopups = (
    <>
      {timerEditOpen && (
          <div className="timer-edit-backdrop" onClick={() => setTimerEditOpen(false)}>
            <div
              ref={timerEditBoxRef}
              className="timer-edit-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="timer-edit-title"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === "Escape") setTimerEditOpen(false)
                trapTab(e, timerEditBoxRef.current)
              }}
            >
              <p id="timer-edit-title" className="timer-edit-title">Set start time</p>
              <input
                className="timer-edit-input"
                value={timerEditValue}
                onChange={(e) => setTimerEditValue(e.target.value)}
                placeholder="0:00:00"
                spellCheck={false}
                autoFocus
                aria-invalid={timerEditInvalid}
                aria-describedby={timerEditInvalid ? "timer-edit-error" : undefined}
                style={timerEditInvalid ? { outline: "2px solid #db2800" } : undefined}
                onKeyDown={(e) => e.key === "Enter" && applyTimerEdit()}
              />
              {timerEditInvalid && (
                <p id="timer-edit-error" className="timer-edit-error" role="alert">
                  Use h:mm:ss, m:ss or seconds
                </p>
              )}
              <div className="timer-edit-actions">
                <button type="button" className="timer-edit-btn timer-edit-cancel" onClick={() => setTimerEditOpen(false)}>Cancel</button>
                <button type="button" className="timer-edit-btn" onClick={applyTimerEdit} disabled={timerEditInvalid}>Set</button>
              </div>
            </div>
          </div>
      )}
      {gemPopupOpen && (
          <div className="gem-modal-backdrop" onClick={() => setGemPopupOpen(false)}>
            <div
              className="gem-modal-box"
              role="dialog"
              aria-modal="true"
              aria-labelledby="gem-modal-title"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.key === "Escape" && setGemPopupOpen(false)}
            >
              <p id="gem-modal-title" className="gem-modal-title">How many gems?</p>
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
    </>
  )

  return (
    <>

      <div
        className={`overlay-wrapper${commentatorCount === 1 ? " single-com" : ""}${theme === "arcade" && runnerCount === 2 ? " theme-arcade" : ""}${theme === "arcade" && runnerCount !== 2 ? " theme-arcade-multi" : ""}${isMaxRando ? " max-rando" : ""}`}
        // CSS zoom, not a scale() transform: Twitch refuses play() inside a scaled-down transform
        // ("minimum requirements for autoplay were not met: style visibility")
        // Hidden until saved state loads, so an OBS reload never shows the default layout on stream
        style={{ ...(stageScale < 1 ? { zoom: stageScale } : {}), ...(hydrated ? {} : { visibility: "hidden" as const }) }}
      >
        {runnerCount !== 2 && hydrated && (
          <FourPlayerOverlay
            key={`${runnerCount}-${clearCount}`}
            ref={quadRef}
            layout={runnerCount === 3 ? TRIO_LAYOUT : QUAD_LAYOUT}
            arcade={theme === "arcade"}
            pairs={runnerCount === 4 && quadPairs}
            bosses={visibleBosses}
            items={ITEMS}
            bossBadges={bossBadges}
            bossBadgeLabels={BOSS_BADGES}
            itemBadges={itemBadges}
            onBossContextMenu={(id) => cycleBadge(id)}
            onClearBossBadge={clearBossBadge}
            onClearItemBadge={clearItemBadge}
            linkToTimer={linkVodsToTimer}
            onLinkToTimerChange={setLinkVodsToTimer}
            onSidePanelContextMenu={reopenSetup}
            toolsSlot={toolsWin ? quadToolsSlot : null}
            onRequestTools={showTools}
            placements={placements}
            onNamesChange={setQuadNames}
            initial={restoredQuadRef.current?.count === runnerCount ? restoredQuadRef.current : undefined}
            onVodsChange={setQuadVods}
            notDefeated={quadNotDefeated}
            notCollected={quadNotCollected}
            onToggleBoss={toggleQuadBoss}
            onToggleItem={toggleQuadItem}
            seriesWins={seriesWins}
            seriesToWin={seriesShown}
            onArrange={arrangeQuadRunners}
            sidePanel={{
              info: chat.on ? <ChatHelp className="quad-side-group" /> : (
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
              commentary: chat.on ? null : (
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
              tracking: chat.on ? null : (
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
                {creditTrackers === 2 && (
                  <input
                    type="text"
                    className="tracking-input quad-side-input"
                    value={tracking2}
                    onChange={(e) => setTracking2(e.target.value)}
                    placeholder="TRACKING 2"
                    aria-label="Tracking 2"
                    spellCheck={false}
                    autoComplete="off"
                  />
                )}
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
                  <TimerText phase={timerPhase} pausedMs={timerMs} accRef={timerAccRef} startRef={timerStartRef} />
                </button>
                {isMaxRando && (
                  <button type="button" className="quad-side-gem" onClick={() => openOperatorPopup(() => setGemPopupOpen(true))} aria-label="Set gem count">
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
        {theme !== "arcade" && isMaxRando && (
          <img
            src="/icons/s_gem_overlay_0.png"
            alt="Gem"
            className="gem-image"
            draggable={false}
            onClick={() => openOperatorPopup(() => setGemPopupOpen(true))}
          />
        )}

        {/* Gem count display */}
        {theme !== "arcade" && isMaxRando && gemCount !== null && (
          <span className="gem-count">{gemCount}</span>
        )}
        </>)}

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
                trackerCount={draftTrackerCount}
                maxRando={draftMaxRando}
                onRunnerCountChange={setDraftRunnerCount}
                onCommentatorCountChange={setDraftCommentatorCount}
                onTrackerCountChange={setDraftTrackerCount}
                onMaxRandoChange={setDraftMaxRando}
                pairs={quadPairs}
                onPairsChange={setQuadPairs}
              />
              <p className="setup-hint">
                {popupBlocked
                  ? "The tools window was blocked. OBS browser sources can't open it: open this page in Chrome and use Window Capture instead. In a normal browser, allow popups and press OK again."
                  : "OK opens a private tools window for videos and setup. It stays hidden from viewers."}
                {" "}
                <a href="https://github.com/TheGobOne/z2r-stream-overlay#readme" target="_blank" rel="noreferrer" className="setup-help-link">
                  Help: README
                </a>
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

        {/* Commentary, tracking and race info as one block. In the Arcade layout the block is centered
            vertically in the space between the tracker boxes, so 1 commentator and 1 tracker don't leave a gap. */}
        <div className="credits-panel">
          {chat.on ? <ChatHelp /> : (<>
          <div className="credits-row">
            <div className="credit-col">
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
            </div>
            <div className="credit-col">
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
                {creditTrackers === 2 && (
                  <input
                    type="text"
                    className="tracking-input"
                    value={tracking2}
                    onChange={(e) => setTracking2(e.target.value)}
                    placeholder="TRACKING 2"
                    spellCheck={false}
                    autoComplete="off"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Race info (Arcade only), with the Max Rando gem beside it */}
          {theme === "arcade" && (
            <div className="race-row">
              <div className="race-col">
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
              </div>
              {isMaxRando && (
                <img
                  src="/icons/s_gem_overlay_0.png"
                  alt="Gem"
                  className="gem-image"
                  draggable={false}
                  onClick={() => openOperatorPopup(() => setGemPopupOpen(true))}
                />
              )}
              {isMaxRando && gemCount !== null && <span className="gem-count">{gemCount}</span>}
            </div>
          )}
          </>)}
        </div>

        {/* Timer */}
        <div
          className={`timer-display${timerPhase === 1 ? " running" : timerPhase === 2 ? " paused" : ""}`}
          onClick={handleTimerClick}
          onMouseDown={(e) => e.button === 1 && e.preventDefault()}
          onAuxClick={handleTimerMiddleClick}
          onContextMenu={handleTimerRightClick}
          title="Click: start/pause/resume | Middle-click: reset to 0 | Right-click: edit start time"
        >
          <TimerText phase={timerPhase} pausedMs={timerMs} accRef={timerAccRef} startRef={timerStartRef} />
        </div>
        </>)}

        {toolsWin && (
          <ToolsWindowPortal win={toolsWin}>
            <main className="tools booth">
              <header className="tools-header">
                <p className="tools-reopen-note">If you ever accidentally close this window right-click on open black space by the timer.</p>
                <h1 className="tools-heading">Booth</h1>
                <p className="tools-subheading">Only you can see this window. Changes apply to the overlay instantly.</p>
              </header>
              <BoothLayout
                panels={[
                  { id: "monitor", title: "Program monitor", node: <ProgramMonitor win={toolsWin} /> },
                  {
                    id: "timer",
                    title: "Race timer",
                    node: (
                <section className="booth-timer" aria-label="Race timer">
                  <p className={`booth-timer-time${timerPhase === 1 ? " running" : timerPhase === 2 ? " paused" : ""}`}>
                    <TimerText phase={timerPhase} pausedMs={timerMs} accRef={timerAccRef} startRef={timerStartRef} />
                  </p>
                  <div className="booth-timer-buttons">
                    <button type="button" className="vod-btn vod-btn-primary" onClick={handleTimerClick}>
                      {timerPhase === 1 ? "Pause" : timerPhase === 2 ? "Resume" : "Start"}
                    </button>
                    {/* Two clicks, with a gap from Pause: a slip mid-race would restart the clock and linked videos */}
                    <button
                      type="button"
                      className={`vod-btn booth-timer-reset${resetArmed ? " vod-btn-danger" : ""}`}
                      onClick={() => {
                        if (!resetArmed) return setResetArmed(true)
                        setResetArmed(false)
                        resetTimer()
                      }}
                    >
                      {resetArmed ? "Click again to reset" : "Reset"}
                    </button>
                  </div>
                </section>
                    ),
                  },
                  {
                    id: "setup",
                    title: "Setup",
                    node: (
              <section className="tools-card" aria-labelledby="tools-setup-title">
                <SetupForm
                  id="tools-setup"
                  title={{ id: "tools-setup-title", text: "Setup" }}
                  runnerCount={runnerCount}
                  commentatorCount={commentatorCount}
                  trackerCount={creditTrackers}
                  maxRando={isMaxRando}
                  onRunnerCountChange={applyRunnerCount}
                  onCommentatorCountChange={applyCommentatorCount}
                  onTrackerCountChange={applyTrackerCount}
                  onMaxRandoChange={applyMaxRando}
                  pairs={quadPairs}
                  onPairsChange={setQuadPairs}
                  placements={placements}
                  playerLabels={runnerCount === 2 ? [leftText, rightText] : quadNames}
                  onPlacementChange={(player, place) => setPlacements((prev) => assignPlace(prev, player, place))}
                />
              </section>
                    ),
                  },
                  {
                    id: "series",
                    title: "Series score",
                    node: (
              <SeriesTools
                names={runnerCount === 2 ? [leftText, rightText] : Array.from({ length: runnerCount }, (_, i) => quadNames[i] ?? "")}
                wins={seriesWins}
                bestOf={seriesBestOf}
                onBestOfChange={changeSeriesBestOf}
                onChange={changeSeriesWins}
                onReset={() => {
                  if (!(toolsWin ?? window).confirm("Set every series score to 0?")) return
                  seriesAwardedRef.current = new Set()
                  setSeriesWins([0, 0, 0, 0])
                  saveSeries(seriesBestOf, [0, 0, 0, 0])
                }}
              />
                    ),
                  },
                  {
                    id: "racetime",
                    title: "Racetime.gg room",
                    node: (
              <RacetimeTools
                room={racetimeRoom}
                summary={racetimeSummary}
                error={racetimeError}
                busy={racetimeBusy}
                onImport={importRacetime}
                onUnlink={unlinkRacetime}
                onSwap={runnerCount === 2 ? swapRacetimeRunners : undefined}
              />
                    ),
                  },
                  {
                    id: "remote",
                    title: "Remote trackers",
                    node: (
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
                    ),
                  },
                  {
                    id: "trackers",
                    title: "Bosses and items",
                    node: (
              <TrackerTools
                bosses={visibleBosses}
                items={ITEMS}
                bossBadges={bossBadges}
                bossBadgeLabels={BOSS_BADGES}
                itemBadges={itemBadges}
                onCycleBossBadge={cycleBadge}
                onClearBossBadge={clearBossBadge}
                onSetItemBadge={setItemBadge}
                badgeOptions={BADGE_OPTIONS}
              />
                    ),
                  },
                  {
                    id: "videos",
                    title: "Videos",
                    node: (
              <>
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
              </>
                    ),
                  },
                  {
                    id: "chat",
                    title: "Chat commands",
                    node: (
                      <ChatCommandsTools
                        channel={chat.channel}
                        on={chat.on}
                        everyone={chat.everyone}
                        status={chat.status}
                        log={chat.log}
                        validChannel={chat.validChannel}
                        onChannel={chat.setChannel}
                        onToggle={chat.setOn}
                        onEveryone={chat.setEveryone}
                      />
                    ),
                  },
                  {
                    id: "starting",
                    title: "Starting screen",
                    node: (
                      <StartingScreenTools
                        quad={runnerCount !== 2}
                        runnerNames={runnerCount === 2 ? [leftText, rightText] : quadNames}
                        shareCode={trackerCode}
                        sharing={trackerSharing || trackerBusy}
                        onShare={() => startTrackerSharing()}
                        onData={setStartingData}
                      />
                    ),
                  },
                  {
                    id: "clear",
                    title: "Clear",
                    node: (
              <section className="tools-card" aria-labelledby="tools-clear-title">
                <h2 id="tools-clear-title" className="tools-card-title">Clear</h2>
                <button type="button" className="tools-clear-btn" onClick={clearOverlay}>
                  Clear overlay
                </button>
              </section>
                    ),
                  },
                ]}
              />
            </main>
            {operatorPopups}
          </ToolsWindowPortal>
        )}
        {!toolsWin && operatorPopups}

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

              <PlaceBadge place={placements[0]} win={duoWindows.left} edge="top" />
              <PlaceBadge place={placements[1]} win={duoWindows.right} edge="top" />

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

    </>
  )
}
