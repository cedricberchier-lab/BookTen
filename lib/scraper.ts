import type { Sport } from "@/types"

const FAIRPLAY_BASE = "https://online.centrefairplay.ch"

const SPORT_PAGES: Record<Sport, string> = {
  tennis_int: "tableau_int.php",
  tennis_ext: "tableau.php",
  squash: "tableau_squash.php",
  badminton: "tableau_bad.php",
  padel: "tableau_padel.php",
}

export async function fetchFairplayHtml(sport: Sport, d?: string): Promise<string> {
  const page = SPORT_PAGES[sport]
  const url = d
    ? `${FAIRPLAY_BASE}/${page}?responsive=false&d=${encodeURIComponent(d)}`
    : `${FAIRPLAY_BASE}/${page}?responsive=false`

  const res = await fetch(url, {
    next: { revalidate: 60 }, // cache for 1 minute
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; FairPlayReader/1.0)",
      Accept: "text/html",
    },
  })

  if (!res.ok) throw new Error(`FairPlay fetch failed: ${res.status}`)
  return res.text()
}

export const FAIRPLAY_BASE_URL = FAIRPLAY_BASE
