"use client";

import { useEffect, useState } from "react";

type GeoState = {
  status: "idle" | "loading" | "ready" | "error";
  coords?: GeolocationCoordinates;
  error?: string;
};

export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: "idle" });

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setState({ status: "error", error: "Geolocation not supported" });
      return;
    }

    setState({ status: "loading" });

    const watchId = navigator.geolocation.watchPosition(
      (position) => setState({ status: "ready", coords: position.coords }),
      (error) => setState({ status: "error", error: error.message }),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 60000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return state;
}
