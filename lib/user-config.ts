const CONFIG_KEY = "fairplay_user_config"

export type UserConfig = {
  displayName: string  // must match name as shown in FairPlay grid cells e.g. "C Berchier"
}

export function getUserConfig(): UserConfig | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    return raw ? (JSON.parse(raw) as UserConfig) : null
  } catch {
    return null
  }
}

export function setUserConfig(config: UserConfig): void {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config))
}
