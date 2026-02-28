"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarCheck, Compass, BookMarked } from "lucide-react"
import type { Route } from "next"

const TABS: { href: Route<string>; label: string; Icon: React.ElementType }[] = [
  { href: "/",         label: "Book",    Icon: CalendarCheck },
  { href: "/explore",  label: "Explore", Icon: Compass       },
  { href: "/bookings", label: "MyRes",   Icon: BookMarked    },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100 flex">
      {TABS.map(({ href, label, Icon }) => {
        const active = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 py-3 transition-colors ${
              active ? "text-gray-900" : "text-gray-400 hover:text-gray-600"
            }`}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            <span className={`text-[11px] font-medium ${active ? "text-gray-900" : "text-gray-400"}`}>
              {label}
            </span>
            {active && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-gray-900" />
            )}
          </Link>
        )
      })}
    </nav>
  )
}
