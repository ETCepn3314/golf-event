import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isOrganizer, jsonError, loadEvent } from "@/lib/api";
import { updateHolesSchema } from "@/lib/validation";

/** Organizer: replace the course scorecard (pars and stroke indexes). */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const event = await loadEvent(slug);
  if (!event) return jsonError(404, "Event not found");
  if (!isOrganizer(req, event)) return jsonError(403, "Organizer PIN required");

  const body = await req.json().catch(() => null);
  const parsed = updateHolesSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError(400, parsed.error.issues[0]?.message ?? "Invalid request");
  }

  const { error: delErr } = await db().from("holes").delete().eq("event_id", event.id);
  if (delErr) return jsonError(500, delErr.message);

  const { error: insErr } = await db()
    .from("holes")
    .insert(
      parsed.data.holes.map((h) => ({
        event_id: event.id,
        hole_number: h.holeNumber,
        par: h.par,
        stroke_index: h.strokeIndex ?? null,
      }))
    );
  if (insErr) return jsonError(500, insErr.message);

  return NextResponse.json({ ok: true });
}
