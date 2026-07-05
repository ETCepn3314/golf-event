import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOrganizer, jsonError, loadEvent } from "@/lib/api";
import { upsertTeamSchema } from "@/lib/validation";

/** Organizer: rename a team and replace its player roster. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { slug, teamId } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const body = await req.json().catch(() => null);
  const parsed = upsertTeamSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const { error } = await db()
    .from("teams")
    .update({ name: parsed.data.name })
    .eq("id", teamId)
    .eq("event_id", event.id);
  if (error) return jsonError(500, error.message);

  // Update existing players in place (keeps their scores); add any new ones.
  for (const [j, p] of parsed.data.players.entries()) {
    if (p.id) {
      const { error: upErr } = await db()
        .from("players")
        .update({ name: p.name, handicap: p.handicap, sort_order: j })
        .eq("id", p.id)
        .eq("team_id", teamId);
      if (upErr) return jsonError(500, upErr.message);
    } else {
      const { error: insErr } = await db()
        .from("players")
        .insert({ team_id: teamId, name: p.name, handicap: p.handicap, sort_order: j });
      if (insErr) return jsonError(500, insErr.message);
    }
  }

  return NextResponse.json({ ok: true });
}

/** Organizer: remove a team (cascades players and scores). */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ slug: string; teamId: string }> }
) {
  const { slug, teamId } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const { error } = await db()
    .from("teams")
    .delete()
    .eq("id", teamId)
    .eq("event_id", event.id);
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
