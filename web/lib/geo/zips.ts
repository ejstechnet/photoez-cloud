import { readFileSync } from "node:fs";
import path from "node:path";

// US ZIP codes with their city and map position, for the photographer
// directory's "near me" search. The table (us-zips.tsv, ~41,000 rows from
// GeoNames, CC BY 4.0) is read once per server process; no map service or
// API key is involved. Tested in zips.test.ts.

export type Place = { zip?: string; city: string; state: string; lat: number; lng: number };

export const STATE_NAMES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado",
  CT: "Connecticut", DE: "Delaware", DC: "District of Columbia", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky",
  LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire",
  NJ: "New Jersey", NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota",
  OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
};

type Table = {
  byZip: Map<string, Place>;
  // "seattle|WA" → the city's center (the average of its ZIP codes).
  byCity: Map<string, Place & { zips: number }>;
};

let table: Table | null = null;

// Parses the table's text; exported for tests.
export function parseZipTable(text: string): Table {
  const byZip = new Map<string, Place>();
  const sums = new Map<string, { city: string; state: string; lat: number; lng: number; zips: number }>();
  for (const line of text.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [zip, city, state, lat, lng] = line.split("\t");
    if (!STATE_NAMES[state]) continue;
    const place = { zip, city, state, lat: Number(lat), lng: Number(lng) };
    byZip.set(zip, place);
    const key = cityKey(city, state);
    const sum = sums.get(key) ?? { city, state, lat: 0, lng: 0, zips: 0 };
    sum.lat += place.lat;
    sum.lng += place.lng;
    sum.zips += 1;
    sums.set(key, sum);
  }
  const byCity = new Map<string, Place & { zips: number }>();
  for (const [key, s] of sums) byCity.set(key, { city: s.city, state: s.state, lat: s.lat / s.zips, lng: s.lng / s.zips, zips: s.zips });
  return { byZip, byCity };
}

function zipTable(): Table {
  table ??= parseZipTable(readFileSync(path.join(process.cwd(), "lib", "geo", "us-zips.tsv"), "utf8"));
  return table;
}

const cityKey = (city: string, state: string) => `${city.trim().toLowerCase()}|${state.trim().toUpperCase()}`;

// "seattle" / "st-louis": the city's part of a directory address.
export function citySlug(city: string) {
  return city
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function lookupZip(zip: string, t: Table = zipTable()): Place | null {
  return t.byZip.get(zip.trim().slice(0, 5)) ?? null;
}

// A city by its directory address (state code + city slug).
export function cityFromSlug(state: string, slug: string, t: Table = zipTable()): Place | null {
  const st = state.toUpperCase();
  for (const place of t.byCity.values()) {
    if (place.state === st && citySlug(place.city) === slug) return place;
  }
  return null;
}

// What a visitor typed: a ZIP ("98101"), or a city with or without its
// state ("Seattle, WA", "seattle wa", "Seattle", "Seattle, Washington").
export function findPlace(query: string, t: Table = zipTable()): Place | null {
  const q = query.trim();
  if (!q) return null;
  const zip = /^(\d{5})(?:-\d{4})?$/.exec(q);
  if (zip) return lookupZip(zip[1], t);

  const words = q.replace(/,/g, " ").replace(/\s+/g, " ").trim();
  // A state at the end, as a code or its full name.
  for (const [code, name] of Object.entries(STATE_NAMES)) {
    for (const suffix of [code, name]) {
      const re = new RegExp(`^(.+?)\\s+${suffix.replace(/\s/g, "\\s+")}$`, "i");
      const match = re.exec(words);
      if (match) {
        const place = t.byCity.get(cityKey(match[1], code)) ?? t.byCity.get(cityKey(saint(match[1]), code));
        if (place) return place;
      }
    }
  }
  // No state: the biggest city by that name (most ZIP codes).
  let best: (Place & { zips: number }) | null = null;
  const names = new Set([words.toLowerCase(), saint(words).toLowerCase()]);
  for (const place of t.byCity.values()) {
    if (names.has(place.city.toLowerCase()) && (!best || place.zips > best.zips)) best = place;
  }
  return best;
}

// "St. Louis" and "St Paul" are listed as "Saint …".
const saint = (city: string) => city.replace(/^st\.?\s+/i, "Saint ");

// Straight-line distance in miles.
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 3958.8 * 2 * Math.asin(Math.sqrt(h));
}
