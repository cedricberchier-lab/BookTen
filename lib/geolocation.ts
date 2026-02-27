export function formatLocationName(place?: string | null) {
  if (!place) return "Locating...";
  return place;
}
