import { NextRequest, NextResponse } from "next/server"
import { eq, and } from "drizzle-orm"
import { fetchFairplayHtml } from "@/lib/scraper"
import { parseFairplayHtml, resolveISODate, extractPartner } from "@/lib/parser"
import { bookings } from "@/lib/db/schema"
import type { Sport } from "@/types"

// Lazy DB import so missing env var only breaks sync, not the whole app
async function getDb() {
  const { db } = await import("@/lib/db")
  return db
}

const VALID_SPORTS: Sport[] = ["tennis_int", "tennis_ext", "squash", "badminton", "padel"]

export async function POST(req: NextRequest) {
  let body: { sport?: string; d?: string; displayName?: string }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { d, displayName } = body
  const rawSport = body.sport ?? "tennis_int"
  const sport: Sport = VALID_SPORTS.includes(rawSport as Sport)
    ? (rawSport as Sport)
    : "tennis_int"

  if (!displayName?.trim()) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 })
  }

  try {
    const html = await fetchFairplayHtml(sport, d)
    const data = parseFairplayHtml(html, displayName)

    // Resolve the active day to a full ISO date
    const activeDay = data.days.find((day) => day.active)
    if (!activeDay) {
      return NextResponse.json({ error: "Could not determine active date" }, { status: 500 })
    }
    const isoDate = resolveISODate(activeDay.label)

    // Filter to only "mine" slots
    const mineSlots = data.slots.filter((s) => s.status === "mine")

    if (mineSlots.length === 0) {
      return NextResponse.json({ inserted: 0, updated: 0, message: "No bookings found for your name on this day" })
    }

    const db = await getDb()
    let inserted = 0
    let updated = 0

    for (const slot of mineSlots) {
      const partner = slot.occupants
        ? extractPartner(slot.occupants, displayName)
        : null

      // Check if this booking already exists
      const existing = await db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.sport, sport),
            eq(bookings.court, slot.court),
            eq(bookings.date, isoDate),
            eq(bookings.startTime, slot.startTime)
          )
        )
        .limit(1)

      if (existing.length > 0) {
        // Update occupants/partner in case they changed (guest added, etc.)
        await db
          .update(bookings)
          .set({ occupants: slot.occupants ?? null, partner, scrapedAt: new Date() })
          .where(eq(bookings.id, existing[0]!.id))
        updated++
      } else {
        await db.insert(bookings).values({
          sport,
          court: slot.court,
          date: isoDate,
          startTime: slot.startTime,
          endTime: slot.endTime,
          occupants: slot.occupants ?? null,
          partner,
        })
        inserted++
      }
    }

    return NextResponse.json({ inserted, updated, date: isoDate, total: mineSlots.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
