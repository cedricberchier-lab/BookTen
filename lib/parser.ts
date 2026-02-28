import { load } from "cheerio"
import type { AvailabilityResponse, DayNav, Slot, SlotStatus } from "@/types"

const FAIRPLAY_BASE = "https://online.centrefairplay.ch"

function parseTime(raw: string): string {
  // "08h30" → "08:30"
  return raw.trim().replace("h", ":")
}

function addOneHour(time: string): string {
  const [h, m] = time.split(":").map(Number)
  return `${String(h + 1).padStart(2, "0")}:${String(m ?? 0).padStart(2, "0")}`
}

// Works for all sports: tennis_int_base, tennis_ext_base, squash_base, bad_base, padel_2_base…
function isHeaderOrFooter(classes: string): boolean {
  return /\b\w+_base\b/.test(classes)
}

// Works for all sports: *_libre = free, *_indisp = unavailable, everything else = booked
function getSlotStatus(classes: string): SlotStatus {
  if (/_libre\b/.test(classes)) return "free"
  if (/_indisp\b/.test(classes)) return "unavailable"
  return "booked"
}

// Resolve a day label like "Ve 27" or "Di 1" to a full ISO date.
// FairPlay always shows today + 7 future days, so if dayNum < today's day it's next month.
export function resolveISODate(dayLabel: string, ref: Date = new Date()): string {
  const dayNum = parseInt(dayLabel.trim().split(/\s+/).pop() ?? "0", 10)
  const d = new Date(ref)
  if (dayNum < d.getDate()) {
    d.setMonth(d.getMonth() + 1)
  }
  d.setDate(dayNum)
  return d.toISOString().split("T")[0]
}

// Extract partner name: remove displayName from occupants, return the rest.
export function extractPartner(occupants: string, displayName: string): string | null {
  const names = occupants
    .split(/[\n/,]/)
    .map((n) => n.trim())
    .filter(Boolean)
  const partner = names.find((n) => !n.toLowerCase().includes(displayName.toLowerCase()))
  return partner ?? null
}

export function parseFairplayHtml(html: string, displayName?: string): AvailabilityResponse {
  const $ = load(html)

  // Parse day navigation from the date bar
  const days: DayNav[] = []
  $(".barre-top .btn-bar").each((_, el) => {
    const label = $(el).text().trim()
    const isActive = $(el).hasClass("btn-bar-active")
    const onclick = $(el).attr("onclick") ?? ""
    const match = onclick.match(/d=([^'&\s]+)/)
    days.push({ label, active: isActive, d: match?.[1] })
  })

  const displayDate = days.find((d) => d.active)?.label ?? ""

  // Parse time slots from the hours column.
  // Regular sports: div.heures > span.heures
  // Padel: div.demi-heures.cases-et-demi > span.heures
  // Select span.heures directly to handle both.
  const times: string[] = []
  $(".col-heures span.heures").each((_, el) => {
    const text = $(el).text().trim()
    if (text) times.push(parseTime(text))
  })

  // Parse courts — slot cells can be .cases OR .cases-et-demi (padel)
  const courts: string[] = []
  const slots: Slot[] = []

  $(".courts").each((_, courtEl) => {
    // Court name from the first header cell
    const courtName = $(courtEl)
      .find(".cases, .cases-et-demi")
      .filter((_, el) => isHeaderOrFooter($(el).attr("class") ?? ""))
      .first()
      .find(".tableau_entetes")
      .text()
      .trim()

    if (!courtName) return
    courts.push(courtName)

    // Slot cells: .cases or .cases-et-demi that are NOT header/footer
    const cells = $(courtEl)
      .find(".cases, .cases-et-demi")
      .filter((_, el) => !isHeaderOrFooter($(el).attr("class") ?? ""))

    cells.each((timeIndex, cell) => {
      const classes = $(cell).attr("class") ?? ""
      let status = getSlotStatus(classes)

      // Extract all names from multi-line title attribute
      const rawTitle = $(cell).attr("title")?.trim() ?? ""
      const names = rawTitle
        .split("\n")
        .map((n) => n.trim())
        .filter(Boolean)
      const occupants = names.length > 0 ? names.join(" / ") : undefined

      // Mark as "mine" if ANY name matches the user's display name
      if (
        status === "booked" &&
        displayName &&
        names.some((n) => n.toLowerCase().includes(displayName.toLowerCase()))
      ) {
        status = "mine"
      }

      let bookingUrl: string | undefined
      if (status === "free") {
        const onclick = $(cell).attr("onclick") ?? ""
        const match = onclick.match(/reservation1\.php\?d=[^']+/)
        if (match) bookingUrl = `${FAIRPLAY_BASE}/${match[0]}`
      }

      const startTime = times[timeIndex] ?? ""
      const endTime = startTime ? addOneHour(startTime) : ""

      slots.push({ court: courtName, startTime, endTime, status, occupants, bookingUrl })
    })
  })

  return { displayDate, days, times, courts, slots }
}
