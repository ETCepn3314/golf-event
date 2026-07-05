import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateJoinCode } from "@/lib/codes";
import { isOrganizer, jsonError, loadEvent } from "@/lib/api";
import { upsertTeamSchema } from "@/lib/validation";

/** Organizer: list teams incl. join codes (for the admin/share screens). */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const { data: teams } = await db()
    .from("teams")
    .select("id, name, join_code, sort_order, players(id, name, handicap, sort_order)")
    .eq("event_id", event.id)
    .order("sort_order");

  return NextResponse.json({
    teams: (teams ?? []).map((t) => ({
      id: t.id,
      name: t.name,
      joinCode: t.join_code,
      players: (t.players ?? [])
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((p) => ({ id: p.id, name: p.name, handicap: Number(p.handicap) })),
    })),
  });
}

/** Organizer: add a team (and its players) to an existing event. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const body = await req.json().catch(() => null);
  const parsed = upsertTeamSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const { count } = await db()
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id);

  const joinCode = generateJoinCode();
  const { data: team, error } = await db()
    .from("teams")
    .insert({
      event_id: event.id,
      name: parsed.data.name,
      join_code: joinCode,
      sort_order: count ?? 0,
    })
    .select("id")
    .single();
  if (error || !team) return jsonError(500, error?.message ?? "Insert failed");

  if (parsed.data.players.length > 0) {
    const { error: playersErr } = await db()
      .from("players")
      .insert(
        parsed.data.players.map((p, j) => ({
          team_id: team.id,
          name: p.name,
          handicap: p.handicap,
          sort_order: j,
        }))
      );
    if (playersErr) return jsonError(500, playersErr.message);
  }

  return NextResponse.json({ id: team.id, joinCode }, { status: 201 });
}
