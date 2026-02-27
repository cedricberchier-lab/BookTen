"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

type Booking = {
  id: string
  sport: string
  court: string
  date: string
  startTime: string
  endTime: string
  occupants: string | null
  partner: string | null
  scrapedAt: string
}

const SPORT_LABELS: Record<string, string> = {
  tennis_int: "Tennis INT",
  tennis_ext: "Bulle",
  squash: "Squash",
  badminton: "Badminton",
  padel: "Padel",
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("fr-CH", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/bookings")
      .then((r) => r.json())
      .then((data: Booking[] | { error: string }) => {
        if ("error" in data) throw new Error(data.error)
        setBookings(data)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unknown error")
      })
      .finally(() => setLoading(false))
  }, [])

  // Group by month
  const grouped = bookings.reduce<Record<string, Booking[]>>((acc, b) => {
    const month = b.date.slice(0, 7) // "2026-02"
    if (!acc[month]) acc[month] = []
    acc[month]!.push(b)
    return acc
  }, {})

  // Partner stats
  const partnerStats = bookings.reduce<Record<string, { count: number; last: string }>>((acc, b) => {
    if (!b.partner) return acc
    if (!acc[b.partner]) acc[b.partner] = { count: 0, last: b.date }
    acc[b.partner]!.count++
    if (b.date > acc[b.partner]!.last) acc[b.partner]!.last = b.date
    return acc
  }, {})

  const sortedPartners = Object.entries(partnerStats).sort((a, b) => b[1].count - a[1].count)

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Mes réservations</h1>
            <p className="text-sm text-muted-foreground">
              {bookings.length} séance{bookings.length !== 1 ? "s" : ""} enregistrée{bookings.length !== 1 ? "s" : ""}
            </p>
          </div>
          <Link
            href="/"
            className="rounded-lg bg-muted px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary"
          >
            ← Retour
          </Link>
        </div>

        {loading && (
          <p className="animate-pulse text-sm text-muted-foreground">Chargement…</p>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            {error.includes("NEON_DATABASE_URL") || error.includes("Missing")
              ? "Base de données non configurée. Ajoutez NEON_DATABASE_URL dans .env.local et lancez npm run db:push."
              : `Erreur : ${error}`}
          </div>
        )}

        {/* Partner stats */}
        {sortedPartners.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              Partenaires
            </h2>
            <div className="flex flex-wrap gap-2">
              {sortedPartners.map(([name, stats]) => (
                <div
                  key={name}
                  className="rounded-lg border bg-card px-3 py-2 text-sm"
                >
                  <span className="font-medium">{name}</span>
                  <span className="ml-2 text-muted-foreground">
                    {stats.count}× · dernier {formatDate(stats.last)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Bookings by month */}
        {!loading && !error && bookings.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune réservation. Utilisez le bouton "Sync" sur la page principale pour importer vos réservations depuis FairPlay.
          </p>
        )}

        {Object.entries(grouped)
          .sort((a, b) => b[0].localeCompare(a[0]))
          .map(([month, items]) => (
            <div key={month} className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {new Date(month + "-15").toLocaleDateString("fr-CH", { month: "long", year: "numeric" })}
              </h2>
              <div className="divide-y rounded-xl border bg-card overflow-hidden">
                {items.map((b) => (
                  <div key={b.id} className="flex items-center gap-4 px-4 py-3">
                    <div className="min-w-[90px] text-sm font-medium">
                      {formatDate(b.date)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {b.startTime}–{b.endTime}
                    </div>
                    <div className="flex-1 text-sm">
                      <span className="font-medium">{b.court}</span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({SPORT_LABELS[b.sport] ?? b.sport})
                      </span>
                    </div>
                    {b.partner && (
                      <div className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                        avec {b.partner}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
