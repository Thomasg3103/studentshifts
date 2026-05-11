/**
 * Geocoding via OpenStreetMap Nominatim (free, no API key).
 * Returns { lat, lng, displayName } or null on failure.
 *
 * Automatically constrained to Ireland (countrycodes=ie).
 * Eircode-shaped queries (e.g. "H91 A2PA") use the postalcode
 * parameter for a more precise lookup.
 */
const EIRCODE_RE = /^[A-Za-z]\d{2}\s?[A-Za-z\d]{4}$/;
const HEADERS = { "Accept-Language": "en", "User-Agent": "StudentShifts-Demo/1.0" };

// Ireland bounding box for Photon (left, bottom, right, top)
const IE_BBOX = "-10.56,51.39,-5.43,55.43";

async function nominatimFetch(params) {
  const qs = new URLSearchParams({ format: "json", limit: "1", countrycodes: "ie", ...params });
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${qs}`, { headers: HEADERS });
  const data = await res.json();
  if (!data.length) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

// Photon (komoot) — better Irish townland/village coverage, free, no API key
async function photonFetch(query) {
  const qs = new URLSearchParams({ q: query, limit: "1", lang: "en", bbox: IE_BBOX });
  const res = await fetch(`https://photon.komoot.io/api/?${qs}`, { headers: HEADERS });
  const data = await res.json();
  if (!data.features?.length) return null;
  const feat = data.features[0];
  const p = feat.properties;
  const parts = [p.name, p.street, p.city || p.town || p.village, p.state, "Ireland"].filter(Boolean);
  return {
    lat: feat.geometry.coordinates[1],
    lng: feat.geometry.coordinates[0],
    displayName: parts.join(", "),
  };
}

export async function geocodeAddress(rawQuery) {
  try {
    // Strip trailing ", Ireland" — we constrain via countrycodes/bbox instead
    const query = rawQuery.replace(/,?\s*ireland\s*$/i, "").trim();

    if (EIRCODE_RE.test(query)) {
      // Try Nominatim postalcode first for Eircodes
      const code = query.replace(/\s/g, "");
      const result = await nominatimFetch({ postalcode: code });
      if (result) return result;
    }

    // Try Nominatim free-text
    const nominatim = await nominatimFetch({ q: query });
    if (nominatim) return nominatim;

    // Fall back to Photon — better for Irish villages and townlands
    return await photonFetch(query);
  } catch {
    return null;
  }
}

/**
 * Get the device's current GPS position via browser API.
 * Returns { lat, lng } or null if denied/unavailable.
 */
export function getCurrentPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      ()    => resolve(null),
      { timeout: 8000 }
    );
  });
}

/**
 * Haversine distance between two lat/lng points, returned in km.
 */
export function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Human-readable distance string.
 */
export function formatDistance(km) {
  if (km < 1) return `${Math.round(km * 1000)}m away`;
  return `${km.toFixed(1)}km away`;
}

/**
 * Approximate coordinates for common Galway-area location strings.
 * Keyed lowercase so lookups are case-insensitive (see coordsForLocation).
 * Add entries here to avoid hitting Nominatim for frequently-used location names.
 */
export const mockLocationCoords = {
  // Mock / dev strings
  "city centre":   { lat: 53.2707, lng: -9.0568 },
  "near campus":   { lat: 53.2835, lng: -9.0615 },
  "5 min walk":    { lat: 53.2800, lng: -9.0580 },
  "10 min walk":   { lat: 53.2750, lng: -9.0540 },
  "downtown":      { lat: 53.2720, lng: -9.0540 },
  "on-campus":     { lat: 53.2835, lng: -9.0615 },
  // Galway city centre
  "galway city centre":     { lat: 53.2707, lng: -9.0568 },
  "galway city":            { lat: 53.2707, lng: -9.0568 },
  "eyre square":            { lat: 53.2744, lng: -9.0490 },
  "eyre square, galway":    { lat: 53.2744, lng: -9.0490 },
  "shop street":            { lat: 53.2731, lng: -9.0527 },
  "shop street, galway":    { lat: 53.2731, lng: -9.0527 },
  "quay street":            { lat: 53.2697, lng: -9.0535 },
  "william street":         { lat: 53.2726, lng: -9.0527 },
  "mainguard street":       { lat: 53.2720, lng: -9.0538 },
  "prospect hill":          { lat: 53.2757, lng: -9.0481 },
  // University / campus
  "university of galway":   { lat: 53.2833, lng: -9.0617 },
  "nui galway":             { lat: 53.2833, lng: -9.0617 },
  "nuig":                   { lat: 53.2833, lng: -9.0617 },
  "university road":        { lat: 53.2807, lng: -9.0633 },
  // Suburbs & areas
  "salthill":               { lat: 53.2590, lng: -9.0847 },
  "salthill, galway":       { lat: 53.2590, lng: -9.0847 },
  "knocknacarra":           { lat: 53.2617, lng: -9.1074 },
  "westside":               { lat: 53.2774, lng: -9.0983 },
  "renmore":                { lat: 53.2763, lng: -9.0069 },
  "ballybane":              { lat: 53.2905, lng: -9.0066 },
  "doughiska":              { lat: 53.2978, lng: -8.9919 },
  "briarhill":              { lat: 53.2870, lng: -8.9900 },
  "parkmore":               { lat: 53.2840, lng: -8.9951 },
  "headford road":          { lat: 53.2913, lng: -9.0614 },
  "tuam road":              { lat: 53.3033, lng: -9.0396 },
  "oranmore":               { lat: 53.2581, lng: -8.9274 },
  "oranmore, galway":       { lat: 53.2581, lng: -8.9274 },
  "athenry":                { lat: 53.2996, lng: -8.7437 },
  "loughrea":               { lat: 53.1977, lng: -8.5686 },
  "tuam":                   { lat: 53.5150, lng: -8.8564 },
  "clifden":                { lat: 53.4884, lng: -10.0202 },
  "ballinasloe":            { lat: 53.3308, lng: -8.2200 },
  "spiddal":                { lat: 53.2434, lng: -9.3086 },
};

/**
 * Case-insensitive coordinate lookup: checks mockLocationCoords then the
 * persistent geocode cache (passed in as extraCoords).
 */
export function coordsForLocation(location, extraCoords = {}) {
  if (!location) return null;
  const key = location.trim().toLowerCase();
  return mockLocationCoords[key] ?? extraCoords[key] ?? null;
}
