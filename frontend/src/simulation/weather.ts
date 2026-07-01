// ─────────────────────────────────────────────────────────────────────────────
// Ambient (room) temperature from real-world weather
//
// The lab's "room temperature" is fetched from the live weather of the user's
// actual area.  Because that ambient temperature is what every hot sample cools
// *towards*, Newton's law of cooling makes it the value that controls how fast a
// beaker loses heat once it is taken off the hot plate.
//
// Location accuracy: we use the browser's precise GPS coordinates only
// (navigator.geolocation).  We deliberately do NOT fall back to IP geolocation:
// an IP lookup only knows the ISP's gateway city, so when the device is on a
// phone hotspot it reports the hotspot's location (often a different town, e.g.
// Dar es Salaam when you are really in Dodoma).  GPS gives the true location.
// If the user denies the prompt or GPS is unavailable we use a 25 °C lab
// default so the simulation always works.
//
// All services used are free, CORS-enabled and need no API key:
//   • GPS reverse-geocode → api.bigdatacloud.net
//   • Current temperature  → api.open-meteo.com
// ─────────────────────────────────────────────────────────────────────────────

export interface AmbientWeather {
  /** Current outdoor/room temperature in °C. */
  roomTemp: number;
  /** Human-readable place name, e.g. "Dodoma, TZ". */
  location: string;
  /** True when the value came from a live weather lookup (not the fallback). */
  live: boolean;
}

export const DEFAULT_AMBIENT: AmbientWeather = {
  roomTemp: 25,
  location: "Lab (default 25 °C)",
  live: false,
};

interface GeoPoint {
  latitude: number;
  longitude: number;
  city?: string;
  country?: string;
}

// ── Browser GPS — precise, but needs the user's permission ───────────────────
function fetchGpsPosition(timeoutMs: number): Promise<GeoPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => resolve(null),                                   // denied / unavailable
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 },
    );
  });
}

// ── Reverse-geocode coordinates → city name (no key) ─────────────────────────
async function reverseGeocode(p: GeoPoint, signal: AbortSignal): Promise<string | null> {
  try {
    const url =
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${p.latitude}` +
      `&longitude=${p.longitude}&localityLanguage=en`;
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const d = await r.json();
    const city = d.city || d.locality || d.principalSubdivision;
    return [city, d.countryCode].filter(Boolean).join(", ") || null;
  } catch {
    return null;
  }
}

// ── Current temperature for a coordinate (Open-Meteo) ────────────────────────
async function fetchTemperature(p: GeoPoint, signal: AbortSignal): Promise<number | null> {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}` +
      `&longitude=${p.longitude}&current=temperature_2m`;
    const r = await fetch(url, { signal });
    if (!r.ok) return null;
    const d = await r.json();
    const t = d?.current?.temperature_2m;
    return typeof t === "number" ? t : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the live ambient temperature for the user's area.
 * Always resolves (never rejects) — returns DEFAULT_AMBIENT on any failure.
 */
export async function fetchAmbientWeather(timeoutMs = 9000): Promise<AmbientWeather> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Use precise GPS only; reverse-geocode for the real city name.
    // No IP fallback — IP geolocation reports the hotspot/ISP location, not
    // where the device actually is, so we use the lab default instead.
    const point = await fetchGpsPosition(timeoutMs);
    if (!point) return DEFAULT_AMBIENT;
    const place = await reverseGeocode(point, controller.signal);

    const temp = await fetchTemperature(point, controller.signal);
    if (temp === null) return DEFAULT_AMBIENT;

    return {
      roomTemp: Math.round(temp * 10) / 10,
      location: place || "your area",
      live: true,
    };
  } catch {
    return DEFAULT_AMBIENT;
  } finally {
    clearTimeout(timer);
  }
}
