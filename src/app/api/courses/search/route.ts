import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api";

const NOMINATIM = "https://nominatim.openstreetmap.org/search";
const OVERPASS = "https://overpass-api.de/api/interpreter";
const UA = "golf-event-app/1.0 (github.com/ETCepn3314/golf-event)";

async function overpass(query: string) {
  const res = await fetch(OVERPASS, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": UA,
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(25000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Course database returned ${res.status}`);
  }
}

interface OsmElement {
  tags?: Record<string, string>;
  center?: { lat: number; lon: number };
}

function parseHoles(elements: OsmElement[], near?: { lat: number; lon: number }) {
  const holes = elements
    .map((e) => ({
      holeNumber: parseInt(e.tags?.ref ?? ""),
      par: parseInt(e.tags?.par ?? ""),
      strokeIndex: e.tags?.handicap ? parseInt(e.tags.handicap) : null,
      dist: near
        ? Math.hypot((e.center?.lat ?? 999) - near.lat, (e.center?.lon ?? 999) - near.lon)
        : 0,
    }))
    .filter(
      (h) =>
        Number.isInteger(h.holeNumber) &&
        h.holeNumber >= 1 &&
        h.holeNumber <= 18 &&
        Number.isInteger(h.par) &&
        h.par >= 3 &&
        h.par <= 6
    );
  // Resorts can have several mapped courses; keep the way closest to the chosen
  // course's center for each hole number.
  const best = new Map<number, (typeof holes)[number]>();
  for (const h of holes) {
    const cur = best.get(h.holeNumber);
    if (!cur || h.dist < cur.dist) best.set(h.holeNumber, h);
  }
  return [...best.values()]
    .sort((a, b) => a.holeNumber - b.holeNumber)
    .map(({ holeNumber, par, strokeIndex }) => ({ holeNumber, par, strokeIndex }));
}

/**
 * Course lookup backed by OpenStreetMap.
 *   ?q=pebble beach            -> matching golf courses (Nominatim)
 *   ?osm=relation/123&lat=&lon= -> scorecard holes inside that course's polygon
 *                                  (falls back to a 1.2 km radius when unmapped)
 * Data quality varies by course; the UI always allows manual correction.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();
  const osm = url.searchParams.get("osm");
  const lat = parseFloat(url.searchParams.get("lat") ?? "");
  const lon = parseFloat(url.searchParams.get("lon") ?? "");

  try {
    if (q) {
      if (q.length < 3) return jsonError(400, "Type at least 3 characters");
      const search = async (term: string) => {
        const res = await fetch(
          `${NOMINATIM}?q=${encodeURIComponent(term)}&format=jsonv2&limit=10`,
          { headers: { "user-agent": UA }, signal: AbortSignal.timeout(15000) }
        );
        if (!res.ok) throw new Error(`Course search returned ${res.status}`);
        return res.json();
      };
      let results = (await search(q)).filter(
        (p: { type: string }) => p.type === "golf_course"
      );
      if (results.length === 0 && !/golf/i.test(q)) {
        results = (await search(`${q} golf course`)).filter(
          (p: { type: string }) => p.type === "golf_course"
        );
      }
      const courses = results.map(
        (p: {
          osm_type: string;
          osm_id: number;
          display_name: string;
          lat: string;
          lon: string;
        }) => {
          const [name, ...rest] = p.display_name.split(", ");
          return {
            id: `${p.osm_type}/${p.osm_id}`,
            name,
            locality: rest.slice(0, 3).join(", "),
            lat: parseFloat(p.lat),
            lon: parseFloat(p.lon),
          };
        }
      );
      return NextResponse.json({ courses });
    }

    if (osm) {
      const [type, idStr] = osm.split("/");
      const id = parseInt(idStr);
      if (!Number.isInteger(id) || !["way", "relation"].includes(type)) {
        return jsonError(400, "Invalid course id");
      }
      const areaId = type === "relation" ? 3600000000 + id : 2400000000 + id;
      const data = await overpass(
        `[out:json][timeout:15];way(area:${areaId})["golf"="hole"];out center tags 60;`
      );
      let holes = parseHoles(data.elements);

      // Course polygon has no mapped holes: fall back to a tight radius search.
      if (holes.length === 0 && Number.isFinite(lat) && Number.isFinite(lon)) {
        const fallback = await overpass(
          `[out:json][timeout:15];way(around:1200,${lat},${lon})["golf"="hole"];out center tags 60;`
        );
        holes = parseHoles(fallback.elements, { lat, lon });
      }
      return NextResponse.json({ holes });
    }

    return jsonError(400, "Provide ?q= to search or ?osm= for holes");
  } catch (e) {
    const msg =
      e instanceof Error && e.name === "TimeoutError"
        ? "The course database is slow right now — try again in a moment."
        : "Course lookup failed — you can still enter the scorecard manually.";
    return jsonError(502, msg);
  }
}
