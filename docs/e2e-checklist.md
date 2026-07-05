# End-to-end dress rehearsal

Run this once on the deployed URL (or locally) before event day. Takes ~15 minutes.

## Setup
- [ ] Create a **stableford** event at `/new`: 18 holes with stroke indexes, 3 teams × 4 players with handicaps (mix of 0–22), $50/team entry, 60/40 payout, one "Closest to Pin" contest at $25.
- [ ] Confirm the share screen shows the organizer PIN, the leaderboard link, and 3 team links. Copy everything.

## Live scoring
- [ ] Open the public leaderboard on device A (or a second browser window).
- [ ] Open two different team links on devices B and C.
- [ ] Enter holes 1–3 for both teams. Confirm the leaderboard on device A updates within ~10 seconds with correct **thru** and **points**.
- [ ] Tap a leaderboard row — the hole-by-hole detail should expand with per-player strokes.

## Offline behavior
- [ ] On device B, enable airplane mode (or DevTools → Network → Offline).
- [ ] Enter hole 4. The pill should show **"Offline — will retry"**; the score stays visible.
- [ ] Reconnect. The pill should flip to **Saved ✓** and the score should reach the leaderboard.
- [ ] Reload the score entry page while offline — previously entered scores still show.

## Money
- [ ] Engineer a tie (give two teams identical scores through the same holes). The leaderboard should show **T1/T1** and the $ column should show the 1st+2nd money split evenly.
- [ ] Open `/e/<event>/money` — pot math (teams × fee), payouts, and per-team net should be consistent.

## Organizer controls
- [ ] Open `/e/<event>/admin`, confirm the saved PIN unlocks it (or enter it fresh).
- [ ] Correct one score on a team's grid; confirm the leaderboard reflects it on the next poll.
- [ ] Enter the contest winner's name; confirm it appears on the leaderboard's contest strip.
- [ ] Press **Finalize**. Confirm:
  - [ ] Team score entry shows "Event is finalized — scores are locked" and rejects changes.
  - [ ] The money page says final (not projected).
- [ ] Press **Reopen** and confirm scoring works again, then finalize again.

## Other formats (quick pass)
- [ ] `node scripts/seed-demo.mjs scramble` — leaderboard shows one score row per team, vs-par ranking.
- [ ] `node scripts/seed-demo.mjs stroke` — hole rows only complete when all 4 players have scores.
- [ ] `node scripts/seed-demo.mjs best_ball` — expanded rows show 4 player scores; team value = best 2 nets.
