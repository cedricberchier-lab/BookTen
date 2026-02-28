"use client"

import { useEffect, useState, useCallback } from "react"
import type { AvailabilityResponse, Slot, Sport } from "@/types"
import { SPORTS } from "@/types"
import { getUserConfig, setUserConfig } from "@/lib/user-config"

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

  // Suppress unused-variable warnings during rebuild
  void SPORTS; void error; void syncResult; void showNameForm; void nameInput
  void syncing; void fromHour; void toHour; void setFromHour; void setToHour
  void handleSportChange; void handleSlotClick; void handleSync; void saveDisplayName

  return <div className="min-h-screen bg-white" />
}
