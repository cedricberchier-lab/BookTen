"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import type { ReactNode } from "react"
import { ChevronLeft } from "lucide-react"
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

const HOLD_MS = 2000

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

interface TileProps {
  id: string
  heldId: string | null
  holdPct: number
  selected?: boolean
  disabled?: boolean
  onHoldStart: (id: string) => void
  onHoldCancel: () => void
  children: ReactNode
}

function Tile({ id, heldId, holdPct, selected, disabled, onHoldStart, onHoldCancel, children }: TileProps) {
  const isHeld = heldId === id
  return (
    <div
      className={`flex-1 relative rounded-2xl flex flex-col items-center justify-center gap-1 shadow-sm select-none overflow-hidden transition-colors ${
        selected ? "bg-emerald-500 text-white" :
        disabled ? "bg-gray-100"               :
        isHeld   ? "bg-emerald-50"             :
                   "bg-white"
      }`}
      onPointerDown={(e) => {
        if (disabled) return
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        onHoldStart(id)
      }}
      onPointerUp={onHoldCancel}
      onPointerLeave={onHoldCancel}
      onPointerCancel={onHoldCancel}
      style={{ touchAction: "none" }}
    >
      {children}
      {/* Hold progress bar at tile bottom */}
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

export default function HomePage() {
  const [sport, setSport]     = useState<Sport>("tennis_int")
  const [activeD, setActiveD] = useState<string | undefined>(undefined)
  const [data, setData]       = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [displayName, setDisplayName] = useState("")

  // Step: 0=location, 1=day, 2=time
  const [step, setStep]     = useState(0)
  const stepRef             = useRef(0)

  // Hold interaction
  const [heldId, setHeldId] = useState<string | null>(null)
  const [holdPct, setHoldPct] = useState(0)
  const holdRef = useRef<{ raf: number } | null>(null)

  // Selections
  const [selSport, setSelSport] = useState<Sport | null>(null)
  const [selDay,   setSelDay]   = useState<string | null>(null)
  const [selTime,  setSelTime]  = useState<string | null>(null)
  const [done,     setDone]     = useState(false)

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

  // ── Hold logic ────────────────────────────────────────────────────────────

  const confirmHold = useCallback((id: string) => {
    const s = stepRef.current
    setHeldId(null)
    setHoldPct(0)
    holdRef.current = null

    if (s === 0) {
      setSelSport(id as Sport)
      setSport(id as Sport)
      setActiveD(undefined)
      stepRef.current = 1
      setStep(1)
    } else if (s === 1) {
      setSelDay(id)
      setActiveD(id || undefined)
      stepRef.current = 2
      setStep(2)
    } else {
      setSelTime(id)
      setDone(true)
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

  const goBack = useCallback(() => {
    cancelHold()
    const prev = Math.max(0, stepRef.current - 1)
    stepRef.current = prev
    setStep(prev)
    if (prev <= 0) setSelSport(null)
    if (prev <= 1) { setSelDay(null); setActiveD(undefined) }
    setDone(false)
  }, [cancelHold])

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

  // ── Connection line ────────────────────────────────────────────────────────
  // SVG viewBox is 0 0 300 100 — Panel 0 = x:0-100, Panel 1 = x:100-200, Panel 2 = x:200-300
  // Y values are approximate tile centres as % of container height (0–100 units)

  const selSportIdx = selSport ? BOOK_SPORTS.findIndex((s) => s.id === selSport) : -1
  const selDayIdx   = selDay   ? days.findIndex((d) => (d.d ?? d.label) === selDay) : -1
  const selTimeIdx  = selTime  ? FIXED_TIMES.findIndex((t) => t === selTime) : -1

  const SPORT_Y = [28, 73]
  const DAY_Y   = [12, 31, 50, 69, 88]
  const TIME_Y  = [10, 26, 42, 58, 74, 90]

  type Pt = { x: number; y: number }
  const sportPt: Pt | null = selSportIdx >= 0 ? { x: 50,  y: SPORT_Y[selSportIdx] ?? 50 } : null
  const dayPt:   Pt | null = selDayIdx   >= 0 ? { x: 150, y: DAY_Y[selDayIdx]     ?? 50 } : null
  const timePt:  Pt | null = selTimeIdx  >= 0 ? { x: 250, y: TIME_Y[selTimeIdx]   ?? 50 } : null
  const connPts = [sportPt, dayPt, timePt].filter((p): p is Pt => p !== null)

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
        <button
          onClick={() => {
            setDone(false)
            stepRef.current = 0
            setStep(0)
            setSelSport(null)
            setSelDay(null)
            setSelTime(null)
          }}
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          Recommencer
        </button>
      </div>
    )
  }

  // ── Main ──────────────────────────────────────────────────────────────────

  const STEP_LABELS = ["Lieu", "Jour", "Heure"]

  return (
    <div className="h-[calc(100dvh-64px)] bg-gray-50 flex flex-col overflow-hidden">

      {/* Step header */}
      <div className="shrink-0 flex items-center gap-3 px-3 pt-3 pb-2">
        <button
          onClick={goBack}
          className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
            step > 0 ? "bg-white shadow-sm text-gray-600 active:bg-gray-100" : "pointer-events-none opacity-0"
          }`}
        >
          <ChevronLeft size={18} />
        </button>

        {/* Progress bars */}
        <div className="flex-1 flex gap-1.5">
          {STEP_LABELS.map((_, i) => (
            <div
              key={i}
              className={`flex-1 h-1.5 rounded-full transition-colors duration-300 ${
                i < step ? "bg-emerald-400" : i === step ? "bg-emerald-500" : "bg-gray-200"
              }`}
            />
          ))}
        </div>

        <span className="text-sm font-bold text-gray-900 w-10 text-right">
          {STEP_LABELS[step]}
        </span>
      </div>

      {/* Hint */}
      <p className="shrink-0 text-center text-xs text-gray-400 pb-2">
        Maintenir 2s pour sélectionner
      </p>

      {/* Sliding panels — each is 1/3 of 300% = 1 full viewport width */}
      <div className="flex-1 overflow-hidden">
        <div
          className="flex h-full relative"
          style={{
            width: "300%",
            transform: `translateX(-${step * (100 / 3)}%)`,
            transition: "transform 0.35s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          {/* Connection line SVG — spans all 3 panels in viewBox 0 0 300 100 */}
          {connPts.length > 0 && (
            <svg
              className="absolute inset-0 pointer-events-none z-10"
              style={{ width: "100%", height: "100%" }}
              viewBox="0 0 300 100"
              preserveAspectRatio="none"
            >
              {/* Line segments */}
              {connPts.slice(0, -1).map((pt, i) => {
                const next = connPts[i + 1]!
                return (
                  <line
                    key={i}
                    x1={pt.x} y1={pt.y}
                    x2={next.x} y2={next.y}
                    stroke="#ef4444"
                    strokeWidth="0.6"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )
              })}
              {/* Dots — outer filled red, inner white */}
              {connPts.map((pt, i) => (
                <g key={i}>
                  <circle cx={pt.x} cy={pt.y} r="1.8" fill="#ef4444" />
                  <circle cx={pt.x} cy={pt.y} r="0.9" fill="white" />
                </g>
              ))}
            </svg>
          )}
          {/* Panel 0: Location */}
          <div className="flex flex-col gap-2 px-3 pb-3 h-full" style={{ width: "33.333%" }}>
            {BOOK_SPORTS.map((s) => (
              <Tile
                key={s.id}
                id={s.id}
                heldId={heldId}
                holdPct={holdPct}
                selected={selSport === s.id}
                onHoldStart={startHold}
                onHoldCancel={cancelHold}
              >
                <span className="font-bold text-2xl text-gray-900">{s.label}</span>
              </Tile>
            ))}
          </div>

          {/* Panel 1: Days */}
          <div className="flex flex-col gap-2 px-3 pb-3 h-full" style={{ width: "33.333%" }}>
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
                      onHoldStart={startHold}
                      onHoldCancel={cancelHold}
                    >
                      <span className="font-bold text-base text-gray-900">{DAY_SHORT[abbr] ?? abbr}</span>
                      <span className="text-xs text-gray-400">{num}</span>
                    </Tile>
                  )
                })}
          </div>

          {/* Panel 2: Times */}
          <div className="flex flex-col gap-2 px-3 pb-3 h-full" style={{ width: "33.333%" }}>
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
                  onHoldStart={startHold}
                  onHoldCancel={cancelHold}
                >
                  <span className={`font-bold text-xl ${
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
    </div>
  )
}
