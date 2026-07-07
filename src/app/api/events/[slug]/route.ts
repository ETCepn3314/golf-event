import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOrganizer, jsonError, loadEvent, teamFromCode } from "@/lib/api";
import { updateEventSchema } from "@/lib/validation";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");

  const organizerView = isOrganizer(req, event);
  // Private event: full details are only for the organizer or a member holding
  // a valid team join code.
  if (!organizerView && (await teamFromCode(req, event)) === null) {
    return jsonError(403, "This event is private — open it from your team link.");
  }

  const [holes, teams, players, contests] = await Promise.all([
    db()
      .from("holes")
      .select("hole_number, par, stroke_index")
      .eq("event_id", event.id)
      .order("hole_number"),
    db()
      .from("teams")
      .select("id, name, sort_order")
      .eq("event_id", event.id)
      .order("sort_order"),
    db()
      .from("players")
      .select("id, team_id, name, handicap, sort_order")
      .in(
        "team_id",
        (
          await db().from("teams").select("id").eq("event_id", event.id)
        ).data?.map((t) => t.id) ?? []
      )
      .order("sort_order"),
    db()
      .from("contests")
      .select("id, name, prize_amount, winner_name")
      .eq("event_id", event.id),
  ]);

  return NextResponse.json({
    event: {
      slug: event.slug,
      name: event.name,
      eventDate: event.event_date,
      format: event.format,
      status: event.status,
      config: event.config,
    },
    holes: (holes.data ?? []).map((h) => ({
      holeNumber: h.hole_number,
      par: h.par,
      strokeIndex: h.stroke_index,
    })),
    teams: (teams.data ?? []).map((t) => ({ id: t.id, name: t.name })),
    players: (players.data ?? []).map((p) => ({
      id: p.id,
      teamId: p.team_id,
      name: p.name,
      handicap: Number(p.handicap),
    })),
    contests: (contests.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      prizeAmount: Number(c.prize_amount),
      winnerName: c.winner_name,
    })),
    ...(organizerView ? { organizer: true } : {}),
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const body = await req.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const update: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) update.name = parsed.data.name;
  if (parsed.data.status !== undefined) update.status = parsed.data.status;
  if (parsed.data.format !== undefined) update.format = parsed.data.format;
  if (parsed.data.config !== undefined) update.config = parsed.data.config;

  const { error } = await db().from("events").update(update).eq("id", event.id);
  if (error) return jsonError(500, error.message);
  return NextResponse.json({ ok: true });
}
