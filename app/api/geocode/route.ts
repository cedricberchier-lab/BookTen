import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
  }

  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lng);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  const response = await fetch(url.toString(), {
    headers: {
      "User-Agent": "techstack-template-1",
      "Accept-Language": "fr"
    },
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) {
    return NextResponse.json(
      { error: "Geocoding failed" },
      { status: response.status }
    );
  }

  const data = (await response.json()) as {
    address?: {
      city?: string;
      town?: string;
      village?: string;
      suburb?: string;
      state?: string;
      country?: string;
    };
    display_name?: string;
  };

  // Build a readable location string with priority: city > town > village > suburb
  const place =
    data.address?.city ||
    data.address?.town ||
    data.address?.village ||
    data.address?.suburb ||
    data.address?.state ||
    data.address?.country ||
    data.display_name ||
    "Localisation indisponible";

  return NextResponse.json({ place });
}
