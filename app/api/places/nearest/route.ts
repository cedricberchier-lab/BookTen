import { NextResponse } from "next/server";

type OverpassElement = {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: { name?: string; "name:fr"?: string };
};

const toRadians = (value: number) => (value * Math.PI) / 180;

const distanceMeters = (aLat: number, aLon: number, bLat: number, bLon: number) => {
  const earthRadius = 6371000;
  const dLat = toRadians(bLat - aLat);
  const dLon = toRadians(bLon - aLon);
  const lat1 = toRadians(aLat);
  const lat2 = toRadians(bLat);

  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);

  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLon * sinLon;
  return 2 * earthRadius * Math.asin(Math.sqrt(h));
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat"));
  const lng = Number(searchParams.get("lng"));
  const radiusKm = Number(searchParams.get("radius"));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  // Use the requested radius (in km) or default to 10km, but query a larger area
  const requestedRadiusMeters = Number.isFinite(radiusKm) ? radiusKm * 1000 : 10000;
  // Query a larger radius to ensure we get enough results
  const queryRadiusMeters = Math.max(requestedRadiusMeters * 2, 10000);
  // Query for restaurants, cafes, fast food
  const query = `[out:json][timeout:25];
(
  node["amenity"~"restaurant|cafe|fast_food"](around:${queryRadiusMeters},${lat},${lng});
  way["amenity"~"restaurant|cafe|fast_food"](around:${queryRadiusMeters},${lat},${lng});
);
out center 100;`;

  console.log(`[Places API] Querying Overpass API with radius ${queryRadiusMeters}m around ${lat},${lng}`);
  console.log(`[Places API] Query:`, query);

  const response = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      "User-Agent": "techstack-template-1"
    },
    body: query
  });

  if (!response.ok) {
    console.error(`[Places API] Overpass API error: ${response.status} ${response.statusText}`);
    return NextResponse.json(
      { error: "Places lookup failed" },
      { status: response.status }
    );
  }

  const data = (await response.json()) as { elements?: OverpassElement[] };
  const elements = data.elements ?? [];

  console.log(`[Places API] Found ${elements.length} elements from Overpass API`);

  const candidates: { name: string; distance: number }[] = [];

  for (const element of elements) {
    const point = element.center ??
      (element.lat !== undefined && element.lon !== undefined
        ? { lat: element.lat, lon: element.lon }
        : null);

    if (!point) continue;

    const name = element.tags?.["name:fr"] ?? element.tags?.name;
    if (!name) continue;

    const dist = distanceMeters(lat, lng, point.lat, point.lon);
    candidates.push({ name, distance: dist });
  }

  // Return up to 30 restaurants to give more options
  const top = candidates
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 30);

  console.log(`[Places API] Returning ${top.length} restaurants, closest: ${top[0]?.name} at ${(top[0]?.distance / 1000).toFixed(2)}km`);
  console.log(`[Places API] All returned:`, top.map(r => `${r.name} (${(r.distance/1000).toFixed(2)}km)`).join(', '));

  return NextResponse.json({ items: top });
}
