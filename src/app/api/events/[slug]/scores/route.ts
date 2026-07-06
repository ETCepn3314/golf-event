import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  isOrganizer,
  jsonError,
  loadEvent,
  lockedHolesFor,
  teamFromCode,
} from "@/lib/api";
import { submitScoresSchema } from "@/lib/validation";

/**
 * Upsert scores for one team. Idempotent: resubmitting the same hole replaces
 * the previous value, so offline retries and double-sends are harmless.
 * Auth: team join code (own team only) or organizer PIN (any team, incl. after
 * finalize is NOT allowed — organizer must reopen the event to correct).
 * Entries for holes the team has locked are skipped (reported back as
 * `skippedLocked`) rather than failing the batch, so offline queues never jam.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");

  const body = await req.json().catch(() => null);
  const parsed = submitScoresSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const organizer = isOrganizer(req, event);
  let teamId: string;
  if (organizer && parsed.data.teamId) {
    teamId = parsed.data.teamId;
  } else {
    const team = await teamFromCode(req, event);
    if (!team) return jsonError(403, "Valid team code required");
    teamId = team.id;
  }

  if (event.status === "final" && !organizer) {
    return jsonError(409, "Event is finalized — scores are locked");
  }

  // Teams cannot touch holes they've locked in; the organizer always can.
  const locked = organizer ? new Set<number>() : new Set(await lockedHolesFor(teamId));
  const skippedLocked: number[] = [];

  for (const entry of parsed.data.entries) {
    if (locked.has(entry.holeNumber)) {
      if (!skippedLocked.includes(entry.holeNumber)) skippedLocked.push(entry.holeNumber);
      continue;
    }
    let query = db()
      .from("scores")
      .select("id")
      .eq("team_id", teamId)
      .eq("hole_number", entry.holeNumber);
    query =
      entry.playerId === null
        ? query.is("player_id", null)
        : query.eq("player_id", entry.playerId);
    const { data: existing } = await query.maybeSingle();

    if (entry.strokes === null) {
      if (existing) {
        await db().from("scores").delete().eq("id", existing.id);
      }
      continue;
    }

    if (existing) {
      const { error } = await db()
        .from("scores")
        .update({ strokes: entry.strokes, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) return jsonError(500, error.message);
    } else {
      const { error } = await db().from("scores").insert({
        event_id: event.id,
        team_id: teamId,
        player_id: entry.playerId,
        hole_number: entry.holeNumber,
        strokes: entry.strokes,
      });
      // 23505 = unique violation: a concurrent insert won the race; update instead.
      if (error?.code === "23505") {
        let retry = db()
          .from("scores")
          .update({ strokes: entry.strokes, updated_at: new Date().toISOString() })
          .eq("team_id", teamId)
          .eq("hole_number", entry.holeNumber);
        retry =
          entry.playerId === null
            ? retry.is("player_id", null)
            : retry.eq("player_id", entry.playerId);
        const { error: retryErr } = await retry;
        if (retryErr) return jsonError(500, retryErr.message);
      } else if (error) {
        return jsonError(500, error.message);
      }
    }
  }

  if (parsed.data.lockHoles?.length) {
    const { error } = await db()
      .from("hole_locks")
      .upsert(
        parsed.data.lockHoles.map((holeNumber) => ({
          team_id: teamId,
          hole_number: holeNumber,
        })),
        { onConflict: "team_id,hole_number", ignoreDuplicates: true }
      );
    if (error) {
      return jsonError(
        503,
        "Hole locking isn't set up yet — run supabase/migrations/20260706_hole_locks.sql in the Supabase SQL editor."
      );
    }
  }

  if (parsed.data.unlockHoles?.length) {
    if (!organizer) return jsonError(403, "Only the organizer can unlock holes");
    const { error } = await db()
      .from("hole_locks")
      .delete()
      .eq("team_id", teamId)
      .in("hole_number", parsed.data.unlockHoles);
    if (error) return jsonError(500, error.message);
  }

  return NextResponse.json({
    ok: true,
    ...(skippedLocked.length > 0 ? { skippedLocked } : {}),
  });
}
