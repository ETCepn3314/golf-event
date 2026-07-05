import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOrganizer, jsonError, loadEvent } from "@/lib/api";
import { setContestWinnerSchema } from "@/lib/validation";

/** Organizer: record (or clear) a side-contest winner. */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string; contestId: string }> }
) {
  const { slug, contestId } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const body = await req.json().catch(() => null);
  const parsed = setContestWinnerSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const { error } = await db()
    .from("contests")
    .update({ winner_name: parsed.data.winnerName })
    .eq("id", contestId)
    .eq("event_id", event.id);
  if (error) return jsonError(500, error.message);

  return NextResponse.json({ ok: true });
}
