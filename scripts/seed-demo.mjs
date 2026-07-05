/**
 * Seeds a demo event with 3 teams and a few holes of scores so you can see the
 * leaderboard working. Requires the dev server running and Supabase configured.
 *
 * Usage: node scripts/seed-demo.mjs [format] [baseUrl]
 *   format: scramble (default) | stroke | best_ball | stableford
 */
const FORMAT = process.argv[2] ?? "scramble";
const BASE = process.argv[3] ?? "http://localhost:3000";

const PARS = [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 4];
const needsPlayers = FORMAT !== "scramble";

const body = {
  name: `Demo ${FORMAT} Open`,
  format: FORMAT,
  config: {
    entryFeePerTeam: 100,
    payout: { type: "percentage", places: [50, 30, 20] },
    holesToPlay: 18,
    ...(FORMAT === "best_ball" ? { bestBall: { countBestN: 2, handicapAllowancePct: 100 } } : {}),
  },
  holes: PARS.map((par, i) => ({ holeNumber: i + 1, par, strokeIndex: i + 1 })),
  teams: ["The Mulligans", "Sandbaggers", "Fore Play"].map((name) => ({
    name,
    players: Array.from({ length: 4 }, (_, i) => ({
      name: `${name.split(" ")[0]} P${i + 1}`,
      handicap: [0, 9, 18, 22][i],
    })),
  })),
  contests: [
    { name: "Closest to Pin #3", prizeAmount: 25 },
    { name: "Longest Drive #11", prizeAmount: 25 },
  ],
};

const res = await fetch(`${BASE}/api/events`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
const created = await res.json();
if (!res.ok) {
  console.error("Create failed:", created);
  process.exit(1);
}

// Enter scores for the first 6 holes for teams 1-2, first 3 for team 3.
const eventInfo = await (await fetch(`${BASE}/api/events/${created.slug}`)).json();
const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

for (const [t, team] of created.teams.entries()) {
  const thru = t === 2 ? 3 : 6;
  const teamPlayers = eventInfo.players.filter((p) => p.teamId === team.id);
  const entries = [];
  for (let h = 1; h <= thru; h++) {
    const par = PARS[h - 1];
    if (needsPlayers) {
      for (const p of teamPlayers) {
        entries.push({ holeNumber: h, playerId: p.id, strokes: par + rand(-1, 2) });
      }
    } else {
      entries.push({ holeNumber: h, playerId: null, strokes: par + rand(-1, 1) });
    }
  }
  await fetch(`${BASE}/api/events/${created.slug}/scores`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-team-code": team.joinCode },
    body: JSON.stringify({ entries }),
  });
}

console.log(`\nSeeded "${body.name}"`);
console.log(`  Leaderboard:  ${BASE}/e/${created.slug}`);
console.log(`  Organizer PIN: ${created.organizerPin}  (admin: ${BASE}/e/${created.slug}/admin)`);
for (const team of created.teams) {
  console.log(`  ${team.name}: ${BASE}/e/${created.slug}/t/${team.joinCode}`);
}
