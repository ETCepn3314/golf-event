/**
 * API smoke test. Requires the dev server running (`npm run dev`) and a
 * configured Supabase project in .env.local.
 *
 * Usage: node scripts/api-smoke.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";

let failures = 0;
function check(name, cond, extra = "") {
  const mark = cond ? "PASS" : "FAIL";
  if (!cond) failures++;
  console.log(`${mark}  ${name}${extra ? ` — ${extra}` : ""}`);
}

async function api(path, { method = "GET", headers = {}, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

const eventBody = {
  name: "Smoke Test Open",
  format: "scramble",
  config: {
    entryFeePerTeam: 100,
    payout: { type: "percentage", places: [50, 30, 20] },
    holesToPlay: 9,
  },
  holes: Array.from({ length: 9 }, (_, i) => ({
    holeNumber: i + 1,
    par: 4,
  })),
  teams: [
    { name: "Team One", players: [{ name: "P1", handicap: 0 }] },
    { name: "Team Two", players: [{ name: "P2", handicap: 0 }] },
    { name: "Team Three", players: [{ name: "P3", handicap: 0 }] },
  ],
  contests: [{ name: "Closest to Pin #3", prizeAmount: 25 }],
};

const created = await api("/api/events", { method: "POST", body: eventBody });
check("create event returns 201", created.status === 201, JSON.stringify(created.json)?.slice(0, 200));
const { slug, organizerPin, teams } = created.json ?? {};
check("create returns slug + pin + 3 teams", !!slug && !!organizerPin && teams?.length === 3);

const pub = await api(`/api/events/${slug}`);
check("public GET returns event", pub.status === 200 && pub.json?.event?.name === "Smoke Test Open");
check("public GET does not leak join codes or PIN", !JSON.stringify(pub.json).includes(organizerPin) && !JSON.stringify(pub.json).includes(teams[0].joinCode));

const badPin = await api(`/api/events/${slug}`, {
  method: "PUT",
  headers: { "x-org-pin": "000000" === organizerPin ? "999999" : "000000" },
  body: { status: "live" },
});
check("wrong PIN rejected with 403", badPin.status === 403);

const badCode = await api(`/api/events/${slug}/scores`, {
  method: "POST",
  headers: { "x-team-code": "ZZZZZ" },
  body: { entries: [{ holeNumber: 1, playerId: null, strokes: 4 }] },
});
check("wrong team code rejected with 403", badCode.status === 403);

const t1 = teams[0];
const sc1 = await api(`/api/events/${slug}/scores`, {
  method: "POST",
  headers: { "x-team-code": t1.joinCode },
  body: {
    entries: [
      { holeNumber: 1, playerId: null, strokes: 3 },
      { holeNumber: 2, playerId: null, strokes: 5 },
    ],
  },
});
check("team score submit accepted", sc1.status === 200);

// Idempotency: resubmit hole 1 with a corrected value, twice.
for (let i = 0; i < 2; i++) {
  await api(`/api/events/${slug}/scores`, {
    method: "POST",
    headers: { "x-team-code": t1.joinCode },
    body: { entries: [{ holeNumber: 1, playerId: null, strokes: 4 }] },
  });
}

const lb = await api(`/api/events/${slug}/leaderboard`);
check("leaderboard returns 200", lb.status === 200);
const row1 = lb.json?.leaderboard?.find((r) => r.teamId === t1.id);
check("team one thru 2, total 9 (4+5) after idempotent resubmits", row1?.thru === 2 && row1?.total === 9, `thru=${row1?.thru} total=${row1?.total}`);
check("pot = fee x teams = 300", lb.json?.pot === 300);

const fin = await api(`/api/events/${slug}`, {
  method: "PUT",
  headers: { "x-org-pin": organizerPin },
  body: { status: "final" },
});
check("organizer can finalize", fin.status === 200);

const lockedScore = await api(`/api/events/${slug}/scores`, {
  method: "POST",
  headers: { "x-team-code": t1.joinCode },
  body: { entries: [{ holeNumber: 3, playerId: null, strokes: 4 }] },
});
check("finalized event rejects team scores with 409", lockedScore.status === 409);

console.log(failures === 0 ? "\nAll smoke tests passed." : `\n${failures} smoke test(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
