import { NextResponse } from "next/server";
import { db } from "./db";

export interface EventRecord {
  id: string;
  slug: string;
  name: string;
  event_date: string | null;
  format: "scramble" | "stroke" | "best_ball" | "stableford";
  status: "setup" | "live" | "final";
  organizer_pin: string;
  config: Record<string, unknown>;
}

export function jsonError(status: number, message: string) {
  return NextResponse.json({ error: message }, { status });
}

export async function loadEvent(slug: string): Promise<EventRecord | null> {
  const { data, error } = await db()
    .from("events")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  // Distinguish "no such event" from "the database is unreachable" — otherwise
  // connection problems masquerade as 404s.
  if (error) throw new Error(`Database error: ${error.message}`);
  return (data as EventRecord | null) ?? null;
}

export function isOrganizer(req: Request, event: EventRecord): boolean {
  const pin = req.headers.get("x-org-pin");
  return !!pin && pin === event.organizer_pin;
}

/**
 * Hole numbers locked for a team. Defensive: if the hole_locks table doesn't
 * exist yet (migration not run), behave as if nothing is locked so the rest of
 * the app keeps working.
 */
export async function lockedHolesFor(teamId: string): Promise<number[]> {
  const { data, error } = await db()
    .from("hole_locks")
    .select("hole_number")
    .eq("team_id", teamId);
  if (error || !data) return [];
  return data.map((r) => r.hole_number);
}

/** Returns the team row for the x-team-code header, or null if invalid. */
export async function teamFromCode(
  req: Request,
  event: EventRecord
): Promise<{ id: string; name: string } | null> {
  const code = req.headers.get("x-team-code")?.toUpperCase();
  if (!code) return null;
  const { data } = await db()
    .from("teams")
    .select("id, name")
    .eq("event_id", event.id)
    .eq("join_code", code)
    .maybeSingle();
  return data ?? null;
}
