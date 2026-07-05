import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, loadEvent, teamFromCode } from "@/lib/api";

/** Team identity + roster + this team's current scores, gated by x-team-code. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");

  const team = await teamFromCode(req, event);
  if (!team) return jsonError(403, "Valid team code required");

  const [playersRes, scoresRes, holesRes] = await Promise.all([
    db()
      .from("players")
      .select("id, name, handicap, sort_order")
      .eq("team_id", team.id)
      .order("sort_order"),
    db()
      .from("scores")
      .select("player_id, hole_number, strokes")
      .eq("team_id", team.id),
    db()
      .from("holes")
      .select("hole_number, par, stroke_index")
      .eq("event_id", event.id)
      .order("hole_number"),
  ]);

  return NextResponse.json({
    event: {
      name: event.name,
      format: event.format,
      status: event.status,
    },
    team: { id: team.id, name: team.name },
    players: (playersRes.data ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      handicap: Number(p.handicap),
    })),
    holes: (holesRes.data ?? []).map((h) => ({
      holeNumber: h.hole_number,
      par: h.par,
      strokeIndex: h.stroke_index,
    })),
    scores: (scoresRes.data ?? []).map((s) => ({
      playerId: s.player_id,
      holeNumber: s.hole_number,
      strokes: s.strokes,
    })),
  });
}
