"use client"

import { useEffect, useState, useCallback } from "react"
import { MapPin, CalendarDays, Clock } from "lucide-react"
import type { AvailabilityResponse, Slot, Sport } from "@/types"
import { getUserConfig, setUserConfig } from "@/lib/user-config"

// ── Helpers ───────────────────────────────────────────────────────────────────

// Only two location categories shown on Book page
const BOOK_SPORTS: { id: Sport; label: string }[] = [
  { id: "tennis_int", label: "Indoor" },
  { id: "tennis_ext", label: "Outdoor" },
]

// Fixed time slots to display
const FIXED_TIMES = ["08:30", "11:30", "12:30", "17:30", "18:30", "19:30"]

const DAY_SHORT: Record<string, string> = {
  Lu: "Lun", Ma: "Mar", Me: "Mer", Je: "Jeu", Ve: "Ven", Sa: "Sam", Di: "Dim",
}

function parseDayLabel(label: string): { abbr: string; num: number } {
  const [abbr, numStr] = label.trim().split(/\s+/)
  return { abbr: abbr ?? "", num: parseInt(numStr ?? "0", 10) }
}

function formatTime(t: string): string {
  const [hh, mm] = t.split(":")
  return `${parseInt(hh ?? "0", 10)}.${mm ?? "00"}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [sport, setSport]       = useState<Sport>("tennis_int")
  const [data, setData]         = useState<AvailabilityResponse | null>(null)
  const [loading, setLoading]   = useState(true)
  const [activeD, setActiveD]   = useState<string | undefined>(undefined)

  const [displayName, setDisplayName] = useState("")
  const [nameInput, setNameInput]     = useState("")
  const [showNameForm, setShowNameForm] = useState(false)

  // ── User config ────────────────────────────────────────────────────────────

  useEffect(() => {
    const config = getUserConfig()
    if (config?.displayName) {
      setDisplayName(config.displayName)
      setNameInput(config.displayName)
    } else {
      setShowNameForm(true)
    }
  }, [])

  const saveDisplayName = () => {
    const name = nameInput.trim()
    if (!name) return
    setUserConfig({ displayName: name })
    setDisplayName(name)
    setShowNameForm(false)
  }

  // ── Data fetching ──────────────────────────────────────────────────────────

  const load = useCallback(async (s: Sport, d?: string, name?: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sport: s })
      if (d) params.set("d", d)
      if (name) params.set("displayName", name)
      const res = await fetch(`/api/availability?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as AvailabilityResponse & { error?: string }
      if (!json.error) setData(json)
    } catch { /* silently ignore */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(sport, activeD, displayName || undefined)
  }, [load, sport, activeD, displayName])

  const handleSportChange = (s: Sport) => {
    setSport(s)
    setActiveD(undefined)
    setData(null)
  }

  const handleSlotClick = (slot: Slot) => {
    if (slot.status === "free" && slot.bookingUrl) {
      window.open(slot.bookingUrl, "_blank", "noopener,noreferrer")
    }
  }

  // ── Derived data ───────────────────────────────────────────────────────────

  // Only the next 5 days
  const days = (data?.days ?? []).slice(0, 5)

  // For each fixed time: is at least one court free?
  const timeAvailability: Record<string, boolean> = {}
  for (const t of FIXED_TIMES) {
    timeAvailability[t] = (data?.slots ?? []).some(
      (s) => s.startTime === t && s.status === "free"
    )
  }

  // First free slot per time (for booking URL)
  const firstFreeSlot = (time: string): Slot | undefined =>
    data?.slots.find((s) => s.startTime === time && s.status === "free")

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">


      {/* ── 3-column filter grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 px-3 pt-4 pb-36">

        {/* ── Col 1: Location (Indoor / Outdoor only) ───────────────── */}
        <div className="flex flex-col gap-2">
          {BOOK_SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSportChange(s.id)}
              className={`rounded-2xl flex items-center justify-center p-4 min-h-[80px] shadow-sm transition-colors ${
                sport === s.id
                  ? "bg-emerald-500 text-white"
                  : "bg-white text-gray-900 hover:bg-gray-50"
              }`}
            >
              <span className="font-bold text-base text-center leading-tight">
                {s.label}
              </span>
            </button>
          ))}
        </div>

        {/* ── Col 2: Next 5 days ────────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {days.map((day) => {
            const { abbr, num } = parseDayLabel(day.label)
            const short = DAY_SHORT[abbr] ?? abbr
            return (
              <button
                key={day.label}
                onClick={() => setActiveD(day.d)}
                className={`rounded-2xl flex flex-col items-center justify-center py-5 gap-0.5 shadow-sm transition-colors ${
                  day.active
                    ? "bg-emerald-500 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="font-bold text-base">{short}</span>
                <span className={`text-xs ${day.active ? "text-emerald-100" : "text-gray-400"}`}>{num}</span>
              </button>
            )
          })}
        </div>

        {/* ── Col 3: Fixed time slots — active if ≥1 court free ────── */}
        <div className="flex flex-col gap-2">
          {FIXED_TIMES.map((time) => {
            const available = !loading && timeAvailability[time]
            const slot = firstFreeSlot(time)
            return (
              <button
                key={time}
                onClick={() => available && slot && handleSlotClick(slot)}
                disabled={loading || !available}
                className={`rounded-2xl flex items-center justify-center py-5 shadow-sm transition-colors ${
                  loading
                    ? "bg-white animate-pulse"
                    : available
                      ? "bg-white hover:bg-emerald-50 active:bg-emerald-100 cursor-pointer"
                      : "bg-gray-100 cursor-default"
                }`}
              >
                <span className={`font-bold text-xl ${
                  loading ? "text-gray-200" : available ? "text-gray-900" : "text-gray-300"
                }`}>
                  {formatTime(time)}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Bottom filter action bar ──────────────────────────────────── */}
      <div className="fixed bottom-16 inset-x-0 px-3 pb-2 flex gap-2">
        <button
          className="flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl shadow-lg text-white font-semibold text-sm"
          style={{ background: "linear-gradient(160deg, #34d399, #059669)" }}
        >
          <MapPin size={18} />
          <span>Loc</span>
        </button>
        <button
          onClick={() => setActiveD(undefined)}
          className="flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl shadow-lg text-white font-semibold text-sm"
          style={{ background: "linear-gradient(160deg, #34d399, #059669)" }}
        >
          <CalendarDays size={18} />
          <span>Day</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center gap-1 py-4 rounded-2xl shadow-lg text-white font-semibold text-sm"
          style={{ background: "linear-gradient(160deg, #34d399, #059669)" }}
        >
          <Clock size={18} />
          <span>Time</span>
        </button>
      </div>

    </div>
  )
}
