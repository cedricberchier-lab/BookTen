import { NextRequest, NextResponse } from "next/server"
import { fetchFairplayHtml } from "@/lib/scraper"
import { parseFairplayHtml } from "@/lib/parser"
import type { Sport } from "@/types"

const VALID_SPORTS: Sport[] = ["tennis_int", "tennis_ext", "squash", "badminton", "padel"]

export async function GET(req: NextRequest) {
  const rawSport = req.nextUrl.searchParams.get("sport") ?? "tennis_int"
  const sport: Sport = VALID_SPORTS.includes(rawSport as Sport)
    ? (rawSport as Sport)
    : "tennis_int"
  const d = req.nextUrl.searchParams.get("d") ?? undefined
  const displayName = req.nextUrl.searchParams.get("displayName") ?? undefined

  try {
    const html = await fetchFairplayHtml(sport, d)
    const data = parseFairplayHtml(html, displayName)
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
