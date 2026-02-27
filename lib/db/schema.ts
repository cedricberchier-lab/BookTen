import { pgTable, text, timestamp, uuid, unique } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull()
})

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sport: text("sport").notNull(),          // "tennis_int" | "tennis_ext" | ...
    court: text("court").notNull(),          // "Tennis n°1"
    date: text("date").notNull(),            // ISO "2026-02-27"
    startTime: text("start_time").notNull(), // "19:00"
    endTime: text("end_time").notNull(),     // "20:00"
    occupants: text("occupants"),            // raw cell text e.g. "C Berchier / P Dupont"
    partner: text("partner"),               // extracted partner name
    scrapedAt: timestamp("scraped_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    uniqueSlot: unique("bookings_unique_slot").on(
      table.sport,
      table.court,
      table.date,
      table.startTime
    ),
  })
)
