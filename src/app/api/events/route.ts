import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateJoinCode, generatePin, generateSlug } from "@/lib/codes";
import { jsonError } from "@/lib/api";
import { createEventSchema } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    return await createEvent(req);
  } catch (e) {
    return jsonError(500, e instanceof Error ? e.message : "Unexpected server error");
  }
}

async function createEvent(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }
  const input = parsed.data;

  const slug = generateSlug();
  const organizerPin = generatePin();

  const { data: event, error: eventErr } = await db()
    .from("events")
    .insert({
      slug,
      name: input.name,
      event_date: input.eventDate ?? null,
      format: input.format,
      status: "live",
      organizer_pin: organizerPin,
      config: input.config,
    })
    .select("id")
    .single();
  if (eventErr || !event) {
    return jsonError(500, `Could not create event: ${eventErr?.message}`);
  }

  const { error: holesErr } = await db()
    .from("holes")
    .insert(
      input.holes.map((h) => ({
        event_id: event.id,
        hole_number: h.holeNumber,
        par: h.par,
        stroke_index: h.strokeIndex ?? null,
      }))
    );
  if (holesErr) return jsonError(500, `Could not create holes: ${holesErr.message}`);

  const teamsOut: { id: string; name: string; joinCode: string }[] = [];
  for (const [i, team] of input.teams.entries()) {
    const joinCode = generateJoinCode();
    const { data: teamRow, error: teamErr } = await db()
      .from("teams")
      .insert({ event_id: event.id, name: team.name, join_code: joinCode, sort_order: i })
      .select("id")
      .single();
    if (teamErr || !teamRow) {
      return jsonError(500, `Could not create team: ${teamErr?.message}`);
    }
    if (team.players.length > 0) {
      const { error: playersErr } = await db()
        .from("players")
        .insert(
          team.players.map((p, j) => ({
            team_id: teamRow.id,
            name: p.name,
            handicap: p.handicap,
            sort_order: j,
          }))
        );
      if (playersErr) {
        return jsonError(500, `Could not create players: ${playersErr.message}`);
      }
    }
    teamsOut.push({ id: teamRow.id, name: team.name, joinCode });
  }

  if (input.contests.length > 0) {
    const { error: contestsErr } = await db()
      .from("contests")
      .insert(
        input.contests.map((c) => ({
          event_id: event.id,
          name: c.name,
          prize_amount: c.prizeAmount,
        }))
      );
    if (contestsErr) {
      return jsonError(500, `Could not create contests: ${contestsErr.message}`);
    }
  }

  return NextResponse.json(
    { slug, organizerPin, teams: teamsOut },
    { status: 201 }
  );
}
