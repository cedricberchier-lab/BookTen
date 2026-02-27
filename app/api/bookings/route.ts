import { NextResponse } from "next/server"
import { desc } from "drizzle-orm"
import { bookings } from "@/lib/db/schema"

async function getDb() {
  const { db } = await import("@/lib/db")
  return db
}

export async function GET() {
  try {
    const db = await getDb()
    const rows = await db
      .select()
      .from(bookings)
      .orderBy(desc(bookings.date), desc(bookings.startTime))

    return NextResponse.json(rows)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
