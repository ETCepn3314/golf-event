import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { jsonError, loadEvent } from "@/lib/api";
import { computeLeaderboard, computePayouts } from "@/lib/scoring";
import { eventConfigSchema } from "@/lib/validation";
import type { EventConfig, RawScore } from "@/lib/scoring";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");

  const config = eventConfigSchema.parse(event.config ?? {}) as EventConfig;

  const { data: teamRows } = await db()
    .from("teams")
    .select("id, name, sort_order")
    .eq("event_id", event.id)
    .order("sort_order");
  const teamIds = (teamRows ?? []).map((t) => t.id);

  const [holesRes, playersRes, scoresRes, contestsRes] = await Promise.all([
    db()
      .from("holes")
      .select("hole_number, par, stroke_index")
      .eq("event_id", event.id)
      .order("hole_number"),
    teamIds.length
      ? db()
          .from("players")
          .select("id, team_id, name, handicap, sort_order")
          .in("team_id", teamIds)
          .order("sort_order")
      : Promise.resolve({ data: [] }),
    db()
      .from("scores")
      .select("team_id, player_id, hole_number, strokes")
      .eq("event_id", event.id),
    db()
      .from("contests")
      .select("id, name, prize_amount, winner_name")
      .eq("event_id", event.id),
  ]);

  const rows = computeLeaderboard({
    format: event.format,
    config,
    holes: (holesRes.data ?? []).map((h) => ({
      holeNumber: h.hole_number,
      par: h.par,
      strokeIndex: h.stroke_index,
    })),
    teams: (teamRows ?? []).map((t) => ({ id: t.id, name: t.name })),
    players: (playersRes.data ?? []).map((p) => ({
      id: p.id,
      teamId: p.team_id,
      name: p.name,
      handicap: Number(p.handicap),
    })),
    scores: (scoresRes.data ?? []).map(
      (s): RawScore => ({
        teamId: s.team_id,
        playerId: s.player_id,
        holeNumber: s.hole_number,
        strokes: s.strokes,
      })
    ),
  });

  const pot = config.entryFeePerTeam * (teamRows?.length ?? 0);
  const payouts = computePayouts(pot, config.payout, rows);

  return NextResponse.json(
    {
      event: {
        name: event.name,
        format: event.format,
        status: event.status,
      },
      generatedAt: new Date().toISOString(),
      pot,
      payoutsFinal: event.status === "final",
      leaderboard: rows,
      payouts,
      players: (playersRes.data ?? []).map((p) => ({
        id: p.id,
        teamId: p.team_id,
        name: p.name,
      })),
      contests: (contestsRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        prizeAmount: Number(c.prize_amount),
        winnerName: c.winner_name,
      })),
    },
    {
      headers: {
        // Let Vercel's CDN absorb polling from many phones.
        "Cache-Control": "public, s-maxage=5, stale-while-revalidate=10",
      },
    }
  );
}
