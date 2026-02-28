"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { CalendarDays, RefreshCw, BookMarked } from "lucide-react"
import type { AvailabilityResponse, Slot, Sport } from "@/types"
import { SPORTS } from "@/types"
import { getUserConfig, setUserConfig } from "@/lib/user-config"

// ── Day label helpers ────────────────────────────────────────────────────────

const DAY_LETTER: Record<string, string> = {
  Lu: "L", Ma: "M", Me: "M", Je: "J", Ve: "V", Sa: "S", Di: "D",
}
const DAY_FULLNAME: Record<string, string> = {
  Lu: "Lundi", Ma: "Mardi", Me: "Mercredi", Je: "Jeudi",
  Ve: "Vendredi", Sa: "Samedi", Di: "Dimanche",
}

function parseDayLabel(label: string): { abbr: string; num: number } {
  const [abbr, numStr] = label.trim().split(/\s+/)
  return { abbr: abbr ?? "", num: parseInt(numStr ?? "0", 10) }
}

function resolveDayDate(label: string): Date {
  const { num } = parseDayLabel(label)
  const today = new Date()
  const d = new Date(today)
  if (num < today.getDate()) d.setMonth(d.getMonth() + 1)
  d.setDate(num)
  return d
}

// ── Slot status ──────────────────────────────────────────────────────────────

function statusColor(status: Slot["status"]): string {
  switch (status) {
    case "free":        return "bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 cursor-pointer border-emerald-200 text-emerald-700"
    case "booked":      return "bg-red-50 border-red-200 text-red-600"
    case "unavailable": return "bg-gray-50 border-gray-200 text-gray-400"
    case "mine":        return "bg-blue-50 border-blue-300 text-blue-700 font-semibold"
  }
}

function statusLabel(status: Slot["status"]): string {
  switch (status) {
    case "free":        return "Libre"
    case "booked":      return ""
    case "unavailable": return "—"
    case "mine":        return "Moi"
  }
}

function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number)
  return `${String(h + 1).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`
}

// ── Hour scroll-snap picker ───────────────────────────────────────────────────

const ITEM_W = 52 // px per hour cell

function HourScrollPicker({
  value,
  onChange,
  min = 8,
  max = 22,
}: {
  value: number
  onChange: (h: number) => void
  min?: number
  max?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const hours = Array.from({ length: max - min + 1 }, (_, i) => min + i)
  const touching = useRef(false)

  const snap = useCallback(() => {
    const el = ref.current
    if (!el) return
    const idx = Math.round(el.scrollLeft / ITEM_W)
    const clamped = Math.max(0, Math.min(hours.length - 1, idx))
    onChange(min + clamped)
  }, [min, hours.length, onChange])

  useEffect(() => {
    if (touching.current) return
    const el = ref.current
    if (!el) return
    const target = (value - min) * ITEM_W
    if (Math.abs(el.scrollLeft - target) > 2) {
      el.scrollTo({ left: target, behavior: "smooth" })
    }
  }, [value, min])

  return (
    <div
      ref={ref}
      onScroll={snap}
      onTouchStart={() => { touching.current = true }}
      onTouchEnd={() => { touching.current = false; snap() }}
      className="overflow-x-scroll scrollbar-hide flex items-center py-3"
      style={{
        scrollSnapType: "x mandatory",
        paddingLeft: `calc(50% - ${ITEM_W / 2}px)`,
        paddingRight: `calc(50% - ${ITEM_W / 2}px)`,
      }}
    >
      {hours.map((h) => (
        <div
          key={h}
          style={{ scrollSnapAlign: "center", minWidth: ITEM_W, width: ITEM_W }}
          className={`text-center text-sm font-semibold select-none transition-colors ${
            h === value ? "text-blue-500" : "text-gray-300"
          }`}
        >
          {String(h).padStart(2, "0")}
        </div>
      ))}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const [sport, setSport] = useState<Sport>("tennis_int")
  const [data, setData] = useState<AvailabilityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeD, setActiveD] = useState<string | undefined>(undefined)

  const [displayName, setDisplayName] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [showNameForm, setShowNameForm] = useState(false)

  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  const [fromHour, setFromHour] = useState(8)
  const [toHour, setToHour] = useState(22)

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

  const load = useCallback(async (s: Sport, d?: string, name?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sport: s })
      if (d) params.set("d", d)
      if (name) params.set("displayName", name)
      const res = await fetch(`/api/availability?${params.toString()}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = (await res.json()) as AvailabilityResponse & { error?: string }
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
    } finally {
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
    setSyncResult(null)
  }

  const handleSlotClick = (slot: Slot) => {
    if (slot.status === "free" && slot.bookingUrl) {
      window.open(slot.bookingUrl, "_blank", "noopener,noreferrer")
    }
  }

  const handleSync = async () => {
    if (!displayName) { setShowNameForm(true); return }
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, d: activeD, displayName }),
      })
      const json = (await res.json()) as {
        inserted?: number; updated?: number; message?: string; error?: string; date?: string
      }
      if (json.error) setSyncResult(`Erreur : ${json.error}`)
      else if (json.message) setSyncResult(json.message)
      else setSyncResult(`Sync ${json.date} — ${json.inserted} nouvelle(s), ${json.updated} mise(s) à jour`)
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  // Derive active day info for the header
  const activeDay = data?.days.find((d) => d.active)
  const activeDayDate = activeDay ? resolveDayDate(activeDay.label) : new Date()
  const { abbr: activeDayAbbr } = activeDay ? parseDayLabel(activeDay.label) : { abbr: "Ve" }
  const activeDayFullName = DAY_FULLNAME[activeDayAbbr] ?? activeDayAbbr
  const activeDayFormatted = activeDayDate.toLocaleDateString("fr-CH", {
    day: "numeric", month: "long", year: "numeric",
  })

  return (
    <div className="min-h-screen bg-white">

      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-start justify-between">
          {/* Left: Today + Calendar */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => { setActiveD(undefined); setSyncResult(null) }}
              className="rounded-full bg-gray-100 px-4 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              Aujourd&apos;hui
            </button>
            <button
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors"
              title="Calendrier"
            >
              <CalendarDays size={16} />
            </button>
          </div>

          {/* Center: Day name + date */}
          <div className="text-center">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{activeDayFullName}</h1>
            <p className="text-xs text-gray-400 mt-0.5">{loading ? "…" : activeDayFormatted}</p>
          </div>

          {/* Right: Sync + Bookings */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSync}
              disabled={syncing}
              title="Synchroniser mes réservations"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
            </button>
            <Link
              href="/bookings"
              title="Mes réservations"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              <BookMarked size={15} />
            </Link>
          </div>
        </div>
      </div>

      {/* ── Day strip ───────────────────────────────────────────────── */}
      <div className="px-2 pb-4">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide px-2">
          {(data?.days ?? []).map((day) => {
            const { abbr, num } = parseDayLabel(day.label)
            const letter = DAY_LETTER[abbr] ?? abbr[0] ?? "?"
            return (
              <button
                key={day.label}
                onClick={() => setActiveD(day.d)}
                className="flex min-w-[40px] flex-col items-center gap-1 py-1 transition-opacity active:opacity-70"
              >
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                    day.active
                      ? "bg-gray-900 text-white"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  {letter}
                </span>
                <span className={`text-xs ${day.active ? "font-semibold text-gray-900" : "text-gray-400"}`}>
                  {num}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Hour range picker ────────────────────────────────────────── */}
      <div className="px-4 pb-3">
        <div className="relative rounded-2xl border border-gray-100 bg-white overflow-hidden">

          {/* Center highlight box */}
          <div className="pointer-events-none absolute inset-0 flex justify-center z-10">
            <div className="w-14 h-full rounded-xl border border-blue-200 bg-blue-50/60" />
          </div>
          {/* Center blue line */}
          <div className="pointer-events-none absolute inset-0 flex justify-center z-20">
            <div className="w-px h-full bg-blue-400/70" />
          </div>

          {/* From picker (top) */}
          <HourScrollPicker
            value={fromHour}
            onChange={(h) => setFromHour(Math.min(h, toHour))}
          />

          {/* Tick divider */}
          <div className="flex items-center px-0 h-4 overflow-hidden">
            <div className="flex w-full justify-around items-end">
              {Array.from({ length: 57 }, (_, i) => (
                <div
                  key={i}
                  className={`w-px ${i % 4 === 0 ? "h-3 bg-gray-300" : "h-1.5 bg-gray-200"}`}
                />
              ))}
            </div>
          </div>

          {/* To picker (bottom) */}
          <HourScrollPicker
            value={toHour}
            onChange={(h) => setToHour(Math.max(h, fromHour))}
          />
        </div>

        {/* Range label */}
        <p className="text-center text-xs text-gray-400 mt-1.5">
          {fromHour === 8 && toHour === 22
            ? "Tous les créneaux"
            : `De ${String(fromHour).padStart(2, "0")}h à ${String(toHour).padStart(2, "0")}h`}
        </p>
      </div>

      {/* ── Display name form ────────────────────────────────────────── */}
      {showNameForm && (
        <div className="mx-4 mb-4 rounded-2xl border bg-gray-50 p-4 space-y-3">
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
              className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-40"
            >
              OK
            </button>
          </div>
          {displayName && (
            <button onClick={() => setShowNameForm(false)} className="text-xs text-gray-400 hover:text-gray-600">
              Annuler
            </button>
          )}
        </div>
      )}

      {/* ── Sync result ──────────────────────────────────────────────── */}
      {syncResult && (
        <div className="mx-4 mb-3 rounded-xl bg-gray-50 px-4 py-2 text-xs text-gray-500">
          {syncResult}
        </div>
      )}

      {/* ── Sport tabs ───────────────────────────────────────────────── */}
      <div className="border-b border-gray-100">
        <div className="flex gap-0 overflow-x-auto scrollbar-hide px-4">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSportChange(s.id)}
              className={`shrink-0 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${
                sport === s.id
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Availability heatmap ─────────────────────────────────────── */}
      {data && !loading && (
        <div className="px-4 pt-3 pb-1">
          <div className="flex gap-px">
            {data.times
              .filter((t) => t >= "08:30" && t <= "21:30")
              .map((time) => {
                const hasFree = data.slots.some(
                  (s) => s.startTime === time && s.status === "free"
                )
                const h = parseInt(time.split(":")[0] ?? "0", 10)
                const isMinute00 = time.endsWith(":00")
                const isInRange = h >= fromHour && h <= toHour
                return (
                  <div
                    key={time}
                    onClick={() => {
                      setFromHour(Math.max(8, h - 1))
                      setToHour(Math.min(22, h + 2))
                    }}
                    className="flex flex-col items-center gap-0.5 flex-1 cursor-pointer group"
                  >
                    <div
                      className={`w-full rounded-sm transition-all ${
                        hasFree
                          ? "bg-emerald-400 group-active:bg-emerald-500"
                          : "bg-gray-100 group-active:bg-gray-200"
                      } ${isInRange ? "h-5" : "h-3 opacity-40"}`}
                    />
                    <span className={`text-[9px] leading-none transition-colors ${
                      isInRange ? "text-gray-500" : "text-gray-300"
                    }`}>
                      {isMinute00 ? String(h).padStart(2, "0") : ""}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* ── Content area ─────────────────────────────────────────────── */}
      <div className="px-4 py-4 space-y-3">

        {/* States */}
        {loading && (
          <p className="text-center text-sm text-gray-400 py-8 animate-pulse">Chargement…</p>
        )}
        {error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Cards */}
        {!loading && data && (() => {
          const filtered = data.slots.filter((s) => {
            if (s.status !== "free" && s.status !== "mine") return false
            const h = parseInt(s.startTime.split(":")[0] ?? "0", 10)
            return h >= fromHour && h <= toHour
          })

          const byCourt = data.courts
            .map((court) => ({
              court,
              slots: filtered.filter((s) => s.court === court),
            }))
            .filter((g) => g.slots.length > 0)

          if (byCourt.length === 0) return (
            <p className="text-center text-sm text-gray-400 py-10">
              Aucun créneau libre
            </p>
          )

          return (
            <div className="space-y-2">
              {byCourt.map((group) => (
                <div key={group.court} className="flex gap-2 items-stretch">

                  {/* Left: court name card — spans full group height */}
                  <div className="w-[30%] bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center p-3">
                    <span className="font-bold text-base text-gray-900 text-center leading-tight">
                      {group.court}
                    </span>
                  </div>

                  {/* Right: day + time pairs */}
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    {group.slots.flatMap((slot) => {
                      const [hh, mm] = slot.startTime.split(":")
                      const timeLabel = `${parseInt(hh ?? "0", 10)}.${mm ?? "00"}`
                      const isMine = slot.status === "mine"
                      return [
                        <div
                          key={`day-${slot.startTime}`}
                          className="bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center py-5"
                        >
                          <span className="font-semibold text-sm text-gray-500">
                            {activeDayAbbr}
                          </span>
                        </div>,
                        <div
                          key={`time-${slot.startTime}`}
                          onClick={() => handleSlotClick(slot)}
                          className={`rounded-2xl shadow-sm border flex items-center justify-center py-5 ${
                            isMine
                              ? "bg-blue-50 border-blue-200"
                              : "bg-white border-gray-100 cursor-pointer active:bg-emerald-50 active:border-emerald-200"
                          }`}
                        >
                          <span className={`font-bold text-xl ${isMine ? "text-blue-600" : "text-gray-900"}`}>
                            {timeLabel}
                          </span>
                        </div>,
                      ]
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        })()}

        {/* Legend */}
        {data && (
          <div className="flex gap-4 text-xs text-gray-400 pt-1">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-emerald-200 bg-emerald-50" />
              Libre
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full border border-blue-200 bg-blue-50" />
              Ma réservation
            </span>
          </div>
        )}

        {/* Display name toggle */}
        {displayName && !showNameForm && (
          <button
            onClick={() => setShowNameForm(true)}
            className="text-xs text-gray-300 hover:text-gray-500 transition-colors"
          >
            Connecté en tant que {displayName}
          </button>
        )}
      </div>
    </div>
  )
}
