"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { ReactNode } from "react"
import type { AvailabilityResponse, Slot, Sport } from "@/types"
import { getUserConfig } from "@/lib/user-config"

// ── Constants ─────────────────────────────────────────────────────────────────

const BOOK_SPORTS: { id: Sport; label: string }[] = [
  { id: "tennis_int", label: "Indoor" },
  { id: "tennis_ext", label: "Outdoor" },
]

const FIXED_TIMES = ["08:30", "11:30", "12:30", "17:30", "18:30", "19:30"]

const DAY_SHORT: Record<string, string> = {
  Lu: "Lun", Ma: "Mar", Me: "Mer", Je: "Jeu", Ve: "Ven", Sa: "Sam", Di: "Dim",
}

const HOLD_MS = 500  // flyover dwell time

// Approximate tile-centre Y positions in a 0–100 viewBox column
const SPORT_Y = [26, 74]
const DAY_Y   = [10, 28, 50, 72, 90]
const TIME_Y  = [8, 24, 40, 56, 72, 88]

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDayLabel(label: string): { abbr: string; num: number } {
  const [abbr, numStr] = label.trim().split(/\s+/)
  return { abbr: abbr ?? "", num: parseInt(numStr ?? "0", 10) }
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(":")
  return `${parseInt(hh ?? "0", 10)}.${mm ?? "00"}`
}

// ── Tile ──────────────────────────────────────────────────────────────────────
// Tiles are purely visual — all pointer logic lives on the container.

interface TileProps {
  id: string
  heldId: string | null
  holdPct: number
  selected?: boolean
  disabled?: boolean
  children: ReactNode
}

function Tile({ id, heldId, holdPct, selected, disabled, children }: TileProps) {
  const isHeld = heldId === id
  return (
    <div
      data-tile-id={id}
      {...(disabled ? { "data-disabled": "" } : {})}
      className={`flex-1 relative rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm select-none overflow-hidden transition-colors ${
        selected ? "bg-emerald-500 text-white" :
        disabled ? "bg-gray-100"               :
        isHeld   ? "bg-emerald-50"             :
                   "bg-white"
      }`}
    >
      {children}
      {isHeld && (
        <div
          className="absolute bottom-0 left-0 h-1.5 bg-emerald-500 rounded-r-full"
          style={{ width: `${holdPct}%`, transition: "none" }}
        />
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

type Pt = { x: number; y: number }

export default function HomePage() {
  const [sport, setSport]     = useState<Sport>("tennis_int")
  const [activeD, setActiveD] = useState<string | undefined>(undefined)
  const [data, setData]       = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState("")

  // Hold animation state
  const [heldId, setHeldId]   = useState<string | null>(null)
  const [holdPct, setHoldPct] = useState(0)
  const holdRef = useRef<{ raf: number } | null>(null)

  // Selections
  const [selSport, setSelSport] = useState<Sport | null>(null)
  const [selDay,   setSelDay]   = useState<string | null>(null)
  const [selTime,  setSelTime]  = useState<string | null>(null)
  const [done,     setDone]     = useState(false)

  // Pointer / rubber-band tracking
  const containerRef   = useRef<HTMLDivElement>(null)
  const [livePos, setLivePos] = useState<Pt | null>(null)
  const lastTileIdRef     = useRef<string | null>(null)  // tile currently under pointer
  const pointerDownTileRef = useRef<string | null>(null)  // tile where pointerdown fired
  const doneTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Config ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const config = getUserConfig()
    if (config?.displayName) setDisplayName(config.displayName)
  }, [])

  // ── Data ──────────────────────────────────────────────────────────────────

  const load = useCallback(async (s: Sport, d?: string, name?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sport: s })
      if (d) params.set("d", d)
      if (name) params.set("displayName", name)
      const res = await fetch(`/api/availability?${params.toString()}`)
      const json = (await res.json()) as AvailabilityResponse & { error?: string }
      if (!json.error) setData(json)
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(sport, activeD, displayName || undefined)
  }, [load, sport, activeD, displayName])

  // ── Done detection (delayed so user sees the completed path) ──────────────

  useEffect(() => {
    if (selSport && selDay && selTime) {
      doneTimerRef.current = setTimeout(() => setDone(true), 600)
      return () => {
        if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
      }
    }
  }, [selSport, selDay, selTime])

  // ── Hold logic ────────────────────────────────────────────────────────────

  const confirmHold = useCallback((id: string) => {
    setHeldId(null)
    setHoldPct(0)
    holdRef.current = null
    lastTileIdRef.current = null    // allow re-entry on same tile after confirm
    pointerDownTileRef.current = null  // prevent double-confirm on subsequent pointerup

    const isSport = BOOK_SPORTS.some((s) => s.id === id)
    const isTime  = FIXED_TIMES.includes(id)

    if (isSport) {
      setSelSport(id as Sport)
      setSport(id as Sport)
      setActiveD(undefined)
      setSelDay(null)
      setSelTime(null)
      setDone(false)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    } else if (isTime) {
      setSelTime(id)
    } else {
      setSelDay(id)
      setActiveD(id || undefined)
      setSelTime(null)
      setDone(false)
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    }
  }, [])

  const startHold = useCallback((id: string) => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current.raf)
    const start = Date.now()
    setHeldId(id)
    setHoldPct(0)

    const tick = () => {
      const pct = Math.min(100, ((Date.now() - start) / HOLD_MS) * 100)
      setHoldPct(pct)
      if (pct < 100) {
        holdRef.current = { raf: requestAnimationFrame(tick) }
      } else {
        confirmHold(id)
      }
    }
    holdRef.current = { raf: requestAnimationFrame(tick) }
  }, [confirmHold])

  const cancelHold = useCallback(() => {
    if (holdRef.current) cancelAnimationFrame(holdRef.current.raf)
    holdRef.current = null
    setHeldId(null)
    setHoldPct(0)
  }, [])

  const reset = useCallback(() => {
    cancelHold()
    if (doneTimerRef.current) clearTimeout(doneTimerRef.current)
    lastTileIdRef.current = null
    pointerDownTileRef.current = null
    setSelSport(null)
    setSelDay(null)
    setSelTime(null)
    setDone(false)
    setLivePos(null)
  }, [cancelHold])

  // ── Pointer tracking — flyover on container ───────────────────────────────
  // Works for both mouse (no press needed) and touch drag.
  // elementFromPoint detects the tile under the pointer on every move.

  const handlePointerActivity = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return

    // Always update rubber-band line position
    const rect = container.getBoundingClientRect()
    setLivePos({
      x: Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width)  * 100)),
      y: Math.max(0, Math.min(100, ((e.clientY - rect.top)  / rect.height) * 100)),
    })

    // Which tile is the pointer over right now?
    const el    = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
    const tile  = el?.closest<HTMLElement>("[data-tile-id]")
    const tileId    = tile?.dataset.tileId    ?? null
    const disabled  = tile?.hasAttribute("data-disabled") ?? false

    // Track which tile the press started on (for hold-and-release validation)
    if (e.type === "pointerdown") {
      pointerDownTileRef.current = tileId
    }

    if (tileId === lastTileIdRef.current) return  // still on same tile, nothing to do

    // Entered a different tile (or left all tiles) — cross-tile move voids press-tracking
    if (e.type === "pointermove") pointerDownTileRef.current = null
    cancelHold()
    lastTileIdRef.current = tileId
    if (tileId && !disabled) startHold(tileId)
  }, [cancelHold, startHold])

  const handlePointerEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.type === "pointerup" && pointerDownTileRef.current) {
      // Check if the pointer is still over the tile it pressed on
      const el   = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null
      const tile = el?.closest<HTMLElement>("[data-tile-id]")
      const tileId   = tile?.dataset.tileId ?? null
      const disabled = tile?.hasAttribute("data-disabled") ?? false

      if (tileId && tileId === pointerDownTileRef.current && !disabled) {
        // "Hold and release" on same tile → confirm immediately
        confirmHold(tileId)
        lastTileIdRef.current = null
        setLivePos(null)
        return
      }
    }
    cancelHold()
    lastTileIdRef.current = null
    pointerDownTileRef.current = null
    setLivePos(null)
  }, [cancelHold, confirmHold])

  // ── Derived ───────────────────────────────────────────────────────────────

  const days = (data?.days ?? []).slice(0, 5)

  const timeAvailability: Record<string, boolean> = {}
  for (const t of FIXED_TIMES) {
    timeAvailability[t] = (data?.slots ?? []).some(
      (s) => s.startTime === t && s.status === "free"
    )
  }

  const firstFreeSlot = (time: string): Slot | undefined =>
    data?.slots.find((s) => s.startTime === time && s.status === "free")

  // ── Connection points (viewBox 0 0 100 100) ───────────────────────────────
  // Column centres: x ≈ 16.7, 50, 83.3

  const selSportIdx = selSport ? BOOK_SPORTS.findIndex((s) => s.id === selSport) : -1
  const selDayIdx   = selDay   ? days.findIndex((d) => (d.d ?? d.label) === selDay) : -1
  const selTimeIdx  = selTime  ? FIXED_TIMES.findIndex((t) => t === selTime) : -1

  const sportPt: Pt | null = selSportIdx >= 0 ? { x: 100 / 6,       y: SPORT_Y[selSportIdx] ?? 50 } : null
  const dayPt:   Pt | null = selDayIdx   >= 0 ? { x: 50,            y: DAY_Y[selDayIdx]     ?? 50 } : null
  const timePt:  Pt | null = selTimeIdx  >= 0 ? { x: (100 * 5) / 6, y: TIME_Y[selTimeIdx]   ?? 50 } : null
  const connPts = [sportPt, dayPt, timePt].filter((p): p is Pt => p !== null)

  const lastPt   = connPts[connPts.length - 1] ?? null
  const showLive = connPts.length > 0 && connPts.length < 3 && livePos !== null

  // ── Done screen ───────────────────────────────────────────────────────────

  if (done && selSport && selTime) {
    const slot = firstFreeSlot(selTime)
    const sportLabel = BOOK_SPORTS.find((s) => s.id === selSport)?.label ?? selSport
    const dayInfo    = days.find((d) => (d.d ?? d.label) === selDay)
    const { abbr, num } = dayInfo ? parseDayLabel(dayInfo.label) : { abbr: "", num: 0 }
    const dayLabel   = `${DAY_SHORT[abbr] ?? abbr} ${num}`

    return (
      <div className="h-[calc(100dvh-64px)] bg-gray-50 flex flex-col items-center justify-center gap-5 px-5">
        <div className="w-full rounded-2xl bg-white shadow-sm p-6 space-y-4 text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-medium">Réservation</p>
          <p className="text-4xl font-bold text-gray-900">{sportLabel}</p>
          <div className="flex justify-center gap-3">
            <span className="rounded-xl bg-emerald-50 text-emerald-700 font-semibold px-4 py-2 text-sm">{dayLabel}</span>
            <span className="rounded-xl bg-emerald-50 text-emerald-700 font-semibold px-4 py-2 text-sm">{formatTime(selTime)}</span>
          </div>
        </div>
        <button
          onClick={() => slot?.bookingUrl && window.open(slot.bookingUrl, "_blank", "noopener,noreferrer")}
          disabled={!slot?.bookingUrl}
          className="w-full rounded-2xl text-white py-5 font-bold text-lg disabled:opacity-40"
          style={{ background: "linear-gradient(160deg, #34d399, #059669)" }}
        >
          Réserver →
        </button>
        <button onClick={reset} className="text-sm text-gray-400 hover:text-gray-600">
          Recommencer
        </button>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  return (
    <div className="h-[calc(100dvh-64px)] bg-gray-50 flex flex-col overflow-hidden px-2 pt-2 pb-2 gap-2">

      {/* Hint */}
      <p className="shrink-0 text-center text-xs text-gray-400">
        Survoler une tuile 0,5s pour sélectionner
      </p>

      {/* 3 columns — all visible, pointer events handled at container level */}
      <div
        ref={containerRef}
        className="flex-1 flex gap-2 relative min-h-0"
        style={{ touchAction: "none" }}
        onPointerDown={handlePointerActivity}
        onPointerMove={handlePointerActivity}
        onPointerLeave={handlePointerEnd}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >

        {/* SVG overlay — confirmed path + live rubber-band */}
        {(connPts.length > 0 || showLive) && (
          <svg
            className="absolute inset-0 pointer-events-none z-10"
            style={{ width: "100%", height: "100%" }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Confirmed segment lines */}
            {connPts.slice(0, -1).map((pt, i) => {
              const next = connPts[i + 1]!
              return (
                <line
                  key={i}
                  x1={pt.x} y1={pt.y}
                  x2={next.x} y2={next.y}
                  stroke="#ef4444"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              )
            })}

            {/* Rubber-band: dashed line from last confirmed point to finger */}
            {showLive && lastPt && (
              <line
                x1={lastPt.x} y1={lastPt.y}
                x2={livePos!.x} y2={livePos!.y}
                stroke="#ef4444"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeDasharray="3 3"
                vectorEffect="non-scaling-stroke"
                opacity="0.5"
              />
            )}

            {/* Confirmed dots */}
            {connPts.map((pt, i) => (
              <g key={i}>
                <circle cx={pt.x} cy={pt.y} r="2.2" fill="#ef4444" />
                <circle cx={pt.x} cy={pt.y} r="1.1" fill="white" />
              </g>
            ))}
          </svg>
        )}

        {/* Column 1: Location */}
        <div className="flex-1 flex flex-col gap-2">
          {BOOK_SPORTS.map((s) => (
            <Tile
              key={s.id}
              id={s.id}
              heldId={heldId}
              holdPct={holdPct}
              selected={selSport === s.id}
            >
              <span className="font-bold text-xl text-gray-900">{s.label}</span>
            </Tile>
          ))}
        </div>

        {/* Column 2: Days */}
        <div className="flex-1 flex flex-col gap-2">
          {days.length === 0
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-1 rounded-2xl bg-white shadow-sm animate-pulse" />
              ))
            : days.map((day) => {
                const { abbr, num } = parseDayLabel(day.label)
                const id = day.d ?? day.label
                return (
                  <Tile
                    key={id}
                    id={id}
                    heldId={heldId}
                    holdPct={holdPct}
                    selected={selDay === id}
                  >
                    <span className="font-bold text-sm text-gray-900">{DAY_SHORT[abbr] ?? abbr}</span>
                    <span className="text-xs text-gray-400">{num}</span>
                  </Tile>
                )
              })}
        </div>

        {/* Column 3: Times */}
        <div className="flex-1 flex flex-col gap-2">
          {FIXED_TIMES.map((time) => {
            const available = !loading && timeAvailability[time]
            return (
              <Tile
                key={time}
                id={time}
                heldId={heldId}
                holdPct={holdPct}
                selected={selTime === time}
                disabled={loading || !available}
              >
                <span className={`font-bold text-lg ${
                  loading ? "text-gray-200" : available ? "text-gray-900" : "text-gray-300"
                }`}>
                  {loading ? "…" : formatTime(time)}
                </span>
              </Tile>
            )
          })}
        </div>

      </div>
    </div>
  )
}
