"use client"

import { useEffect, useState, useCallback } from "react"
import Link from "next/link"
import type { AvailabilityResponse, Slot, Sport } from "@/types"
import { SPORTS } from "@/types"
import { getUserConfig, setUserConfig } from "@/lib/user-config"

function statusColor(status: Slot["status"]): string {
  switch (status) {
    case "free":
      return "bg-emerald-100 hover:bg-emerald-200 cursor-pointer border-emerald-300 text-emerald-800"
    case "booked":
      return "bg-red-50 border-red-200 text-red-700"
    case "unavailable":
      return "bg-gray-100 border-gray-200 text-gray-400"
    case "mine":
      return "bg-blue-100 hover:bg-blue-50 border-blue-300 text-blue-800 font-semibold"
  }
}

function statusLabel(status: Slot["status"]): string {
  switch (status) {
    case "free":      return "Libre"
    case "booked":    return ""
    case "unavailable": return "—"
    case "mine":      return "Moi"
  }
}

export default function HomePage() {
  const [sport, setSport] = useState<Sport>("tennis_int")
  const [data, setData] = useState<AvailabilityResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeD, setActiveD] = useState<string | undefined>(undefined)

  // Display name config
  const [displayName, setDisplayName] = useState("")
  const [nameInput, setNameInput] = useState("")
  const [showNameForm, setShowNameForm] = useState(false)

  // Sync state
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  // Load displayName from localStorage on mount
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
    if (!displayName) {
      setShowNameForm(true)
      return
    }
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport, d: activeD, displayName }),
      })
      const json = (await res.json()) as {
        inserted?: number
        updated?: number
        message?: string
        error?: string
        date?: string
      }
      if (json.error) {
        setSyncResult(`Erreur : ${json.error}`)
      } else if (json.message) {
        setSyncResult(json.message)
      } else {
        setSyncResult(
          `Sync ${json.date} — ${json.inserted} nouvelle(s), ${json.updated} mise(s) à jour`
        )
      }
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : "Sync failed")
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">FairPlay Court Booker</h1>
            <p className="text-sm text-muted-foreground">Centre FairPlay</p>
          </div>
          <div className="flex items-center gap-2">
            {displayName && (
              <button
                onClick={() => setShowNameForm((v) => !v)}
                className="rounded-lg bg-muted px-3 py-1.5 text-xs text-muted-foreground hover:bg-secondary"
                title="Modifier le nom"
              >
                {displayName}
              </button>
            )}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="rounded-lg bg-foreground px-3 py-1.5 text-sm font-medium text-background hover:opacity-90 disabled:opacity-50"
            >
              {syncing ? "Sync…" : "↓ Sync"}
            </button>
            <Link
              href="/bookings"
              className="rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
            >
              Mes réservations
            </Link>
          </div>
        </div>

        {/* Display name form */}
        {showNameForm && (
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <p className="text-sm font-medium">
              Votre nom FairPlay{" "}
              <span className="font-normal text-muted-foreground">
                (tel qu'il apparaît dans les cellules du tableau, ex: C Berchier)
              </span>
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && saveDisplayName()}
                placeholder="Ex: C Berchier"
                className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                onClick={saveDisplayName}
                disabled={!nameInput.trim()}
                className="rounded-lg bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90 disabled:opacity-40"
              >
                Enregistrer
              </button>
            </div>
          </div>
        )}

        {/* Sync result */}
        {syncResult && (
          <div className="rounded-lg border bg-muted/50 px-4 py-2 text-sm text-muted-foreground">
            {syncResult}
          </div>
        )}

        {/* Sport switcher */}
        <div className="flex flex-wrap gap-2 border-b pb-4">
          {SPORTS.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSportChange(s.id)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                sport === s.id
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Day navigator */}
        {data && (
          <div className="flex flex-wrap items-center gap-2">
            {data.days.map((day) => (
              <button
                key={day.label}
                onClick={() => setActiveD(day.d)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  day.active
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-secondary"
                }`}
              >
                {day.label}
              </button>
            ))}
            <button
              onClick={() => void load(sport, activeD, displayName || undefined)}
              className="ml-auto rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
              title="Rafraîchir"
            >
              ↻
            </button>
          </div>
        )}

        {loading && (
          <div className="text-sm text-muted-foreground animate-pulse">
            Chargement du tableau…
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Erreur : {error}
          </div>
        )}

        {/* Grid */}
        {!loading && data && data.slots.length > 0 && (
          <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium text-muted-foreground">Heure</th>
                  {data.courts.map((court) => (
                    <th key={court} className="p-3 text-center font-medium text-muted-foreground whitespace-nowrap">
                      {court}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.times.map((time, timeIndex) => (
                  <tr key={time} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="p-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {time}–{data.times[timeIndex + 1] ?? addOneHour(time)}
                    </td>
                    {data.courts.map((court) => {
                      const slot = data.slots.find(
                        (s) => s.court === court && s.startTime === time
                      )
                      if (!slot) {
                        return (
                          <td key={court} className="p-1.5">
                            <div className="rounded border bg-gray-100 px-2 py-3 text-center text-xs text-gray-400">—</div>
                          </td>
                        )
                      }
                      return (
                        <td key={court} className="p-1.5">
                          <div
                            onClick={() => handleSlotClick(slot)}
                            title={slot.occupants}
                            className={`rounded border px-2 py-3 text-center text-xs transition-colors ${statusColor(slot.status)}`}
                          >
                            {slot.occupants ? slot.occupants : statusLabel(slot.status)}
                          </div>
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Legend */}
        {data && (
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-emerald-300 bg-emerald-100" />
              Libre (cliquer pour réserver)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-blue-300 bg-blue-100" />
              Ma réservation
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-red-200 bg-red-50" />
              Occupé
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded border border-gray-200 bg-gray-100" />
              Indisponible
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number)
  return `${String(h + 1).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`
}
