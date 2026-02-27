export type Sport = "tennis_int" | "tennis_ext" | "squash" | "badminton" | "padel"

export const SPORTS: { id: Sport; label: string }[] = [
  { id: "tennis_int", label: "Tennis INT" },
  { id: "tennis_ext", label: "Bulle" },
  { id: "squash", label: "Squash" },
  { id: "badminton", label: "Badminton" },
  { id: "padel", label: "Padel" },
]

export type SlotStatus = "free" | "booked" | "unavailable" | "mine"

export type Slot = {
  court: string
  startTime: string  // "08:30"
  endTime: string    // "09:30"
  status: SlotStatus
  occupants?: string
  bookingUrl?: string  // only for free slots
}

export type DayNav = {
  label: string   // e.g. "Ve 27"
  d?: string      // FairPlay encoded date param (undefined = today/active)
  active: boolean
}

export type AvailabilityResponse = {
  displayDate: string   // label of the active day e.g. "Ve 27"
  days: DayNav[]
  times: string[]       // ["08:30", "09:30", ...]
  courts: string[]      // ["Tennis n°1", "Tennis n°2", ...]
  slots: Slot[]
}
