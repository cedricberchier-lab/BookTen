"use client"

import { useEffect, useState, useCallback } from "react"
import { MapPin, CalendarDays, Clock } from "lucide-react"
import type { AvailabilityResponse, Slot, Sport } from "@/types"
import { SPORTS } from "@/types"
import { getUserConfig, setUserConfig } from "@/lib/user-config"

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPORT_LABEL: Record<Sport, string> = {
  tennis_int: "Indoor",
  tennis_ext: "Outdoor",
  squash:     "Squash",
  badminton:  "Badminton",
  padel:      "Padel",
}

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

  const freeTimes = data?.slots
    .filter((s) => s.status === "free")
    .map((s) => s.startTime)
    .filter((t, i, arr) => arr.indexOf(t) === i) // dedupe
    .sort() ?? []

  const days = data?.days ?? []

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Name setup form ───────────────────────────────────────────── */}
      {showNameForm && (
        <div className="mx-3 mt-4 rounded-2xl border bg-white p-4 space-y-3 shadow-sm">
          <p className="text-sm text-gray-700">
            Votre nom FairPlay{" "}
            <span className="text-gray-400">(ex : C Berchier)</span>
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveDisplayName()}
              placeholder="C Berchier"
              className="flex-1 rounded-xl border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
              autoFocus
            />
            <button
              onClick={saveDisplayName}
              disabled={!nameInput.trim()}
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              OK
            </button>
          </div>
          {displayName && (
            <button onClick={() => setShowNameForm(false)} className="text-xs text-gray-400">
              Annuler
            </button>
          )}
        </div>
      )}

      {/* ── 3-column filter grid ──────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 px-3 pt-4 pb-36">

        {/* ── Col 1: Location / Sport ───────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {SPORTS.map((s) => (
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
                {SPORT_LABEL[s.id]}
              </span>
            </button>
          ))}
        </div>

        {/* ── Col 2: Day ────────────────────────────────────────────── */}
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

        {/* ── Col 3: Available times ────────────────────────────────── */}
        <div className="flex flex-col gap-2">
          {loading && (
            <div className="rounded-2xl bg-white shadow-sm flex items-center justify-center py-8 animate-pulse">
              <span className="text-gray-300 text-sm">…</span>
            </div>
          )}
          {!loading && freeTimes.length === 0 && (
            <div className="rounded-2xl bg-white shadow-sm flex items-center justify-center py-8">
              <span className="text-gray-300 text-sm">–</span>
            </div>
          )}
          {!loading && freeTimes.map((time) => {
            const slot = data?.slots.find((s) => s.startTime === time && s.status === "free")
            return (
              <button
                key={time}
                onClick={() => slot && handleSlotClick(slot)}
                className="rounded-2xl bg-white shadow-sm flex items-center justify-center py-5 hover:bg-gray-50 active:bg-emerald-50 transition-colors"
              >
                <span className="font-bold text-xl text-gray-900">
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
          onClick={() => setShowNameForm(!showNameForm)}
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

      {/* ── User identity ─────────────────────────────────────────────── */}
      {displayName && !showNameForm && (
        <div className="fixed top-3 right-3 z-10">
          <button
            onClick={() => setShowNameForm(true)}
            className="text-[10px] text-gray-300 hover:text-gray-500 transition-colors"
          >
            {displayName}
          </button>
        </div>
      )}
    </div>
  )
}
