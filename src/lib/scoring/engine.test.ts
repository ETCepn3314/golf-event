import { describe, expect, it } from "vitest";
import { computeLeaderboard } from "./engine";
import {
  BASE_CONFIG,
  HOLES,
  PLAYERS,
  TEAMS,
  playerScores,
  teamScores,
} from "./fixtures/demo";
import type { LeaderboardInput, RawScore } from "./types";

function input(partial: Partial<LeaderboardInput>): LeaderboardInput {
  return {
    format: "scramble",
    config: BASE_CONFIG,
    holes: HOLES,
    teams: TEAMS,
    players: PLAYERS,
    scores: [],
    ...partial,
  };
}

describe("scramble", () => {
  it("totals team scores and computes vsPar and thru", () => {
    const scores = [
      ...teamScores("team-a", 18, -1), // 18 under
      ...teamScores("team-b", 18, 0), // even
      ...teamScores("team-c", 9, 1), // +9 thru 9
    ];
    const rows = computeLeaderboard(input({ scores }));
    expect(rows[0]).toMatchObject({
      teamId: "team-a",
      position: 1,
      thru: 18,
      total: 72 - 18,
      vsPar: -18,
    });
    expect(rows[1]).toMatchObject({ teamId: "team-b", vsPar: 0, thru: 18 });
    expect(rows[2]).toMatchObject({ teamId: "team-c", vsPar: 9, thru: 9 });
  });

  it("compares teams thru different holes by vsPar, not raw total", () => {
    // Bravo is even thru 18 (total 72); Alpha is -2 thru 6 (total much lower but
    // ranked by vsPar, so still ahead).
    const scores = [
      ...teamScores("team-b", 18, 0),
      ...HOLES.slice(0, 6).map((h, i) => ({
        teamId: "team-a",
        playerId: null,
        holeNumber: h.holeNumber,
        strokes: h.par + (i < 2 ? -1 : 0),
      })),
    ];
    const rows = computeLeaderboard(input({ scores }));
    expect(rows[0].teamId).toBe("team-a");
    expect(rows[0].vsPar).toBe(-2);
    expect(rows[0].thru).toBe(6);
  });

  it("puts teams with no scores at the bottom", () => {
    const rows = computeLeaderboard(
      input({ scores: teamScores("team-b", 3, 0) })
    );
    expect(rows[0].teamId).toBe("team-b");
    expect(rows[1].thru).toBe(0);
    expect(rows[2].thru).toBe(0);
  });
});

describe("stroke play", () => {
  it("sums all four players' strokes per hole", () => {
    const scores = [
      ...playerScores("team-a", 18, 0), // 4 players x even par = 288
      ...playerScores("team-b", 18, 1), // 288 + 72... wait: +1/hole/player = 288+72
    ];
    const rows = computeLeaderboard(input({ format: "stroke", scores }));
    expect(rows[0]).toMatchObject({ teamId: "team-a", total: 288, vsPar: 0 });
    expect(rows[1]).toMatchObject({
      teamId: "team-b",
      total: 288 + 72,
      vsPar: 72,
    });
  });

  it("does not count a hole until every player has a score", () => {
    const scores: RawScore[] = playerScores("team-a", 1, 0).slice(0, 3); // 3 of 4 players
    const rows = computeLeaderboard(input({ format: "stroke", scores }));
    const alpha = rows.find((r) => r.teamId === "team-a")!;
    expect(alpha.thru).toBe(0);
    expect(alpha.holeDetails[0].complete).toBe(false);
  });
});

describe("best ball", () => {
  const config = {
    ...BASE_CONFIG,
    bestBall: { countBestN: 2, handicapAllowancePct: 100 },
  };

  it("takes the best N net scores per hole", () => {
    // Hole 1: par 4, SI 1. Handicaps 0/9/18/22 -> strokes received 1? no:
    // SI 1 <= 9 -> p2 gets 1; p3 (18) gets 1; p4 (22) gets 2 on SI 1-4.
    // All players shoot gross 5 -> nets: 5, 4, 4, 3. Best 2 = 3 + 4 = 7.
    const scores: RawScore[] = PLAYERS.filter(
      (p) => p.teamId === "team-a"
    ).map((p) => ({
      teamId: "team-a",
      playerId: p.id,
      holeNumber: 1,
      strokes: 5,
    }));
    const rows = computeLeaderboard(
      input({ format: "best_ball", config, scores })
    );
    const alpha = rows.find((r) => r.teamId === "team-a")!;
    expect(alpha.holeDetails[0].value).toBe(7);
    expect(alpha.vsPar).toBe(7 - 2 * 4);
  });

  it("supports N=1 and N=4 edges", () => {
    const scores: RawScore[] = PLAYERS.filter(
      (p) => p.teamId === "team-a"
    ).map((p) => ({
      teamId: "team-a",
      playerId: p.id,
      holeNumber: 1,
      strokes: 5,
    }));
    // nets on hole 1: [5, 4, 4, 3]
    const n1 = computeLeaderboard(
      input({
        format: "best_ball",
        config: { ...config, bestBall: { countBestN: 1, handicapAllowancePct: 100 } },
        scores,
      })
    ).find((r) => r.teamId === "team-a")!;
    expect(n1.holeDetails[0].value).toBe(3);

    const n4 = computeLeaderboard(
      input({
        format: "best_ball",
        config: { ...config, bestBall: { countBestN: 4, handicapAllowancePct: 100 } },
        scores,
      })
    ).find((r) => r.teamId === "team-a")!;
    expect(n4.holeDetails[0].value).toBe(16);
  });
});

describe("stableford", () => {
  it("awards points per player vs par and sorts descending", () => {
    // team-a: all 4 players even gross. With handicaps 0/9/18/22 on hole 1 (SI 1,
    // par 4, gross 4): nets 4,3,3,2 -> diffs 0,-1,-1,-2 -> points 2+3+3+4 = 12.
    const scores = [
      ...playerScores("team-a", 1, 0),
      ...playerScores("team-b", 1, 2), // gross 6: nets 6,5,5,4 -> 0+0+0+2 = 2... see below
    ];
    const rows = computeLeaderboard(input({ format: "stableford", scores }));
    expect(rows[0].teamId).toBe("team-a");
    expect(rows[0].total).toBe(12);
    // team-b nets: 6 (+2 -> 0), 5 (+1 -> 1), 5 (+1 -> 1), 4 (0 -> 2) = 4
    expect(rows[1].total).toBe(4);
    expect(rows[0].vsPar).toBeNull();
  });

  it("floors points at 0 for scores worse than the table's worst entry", () => {
    const scores: RawScore[] = [
      {
        teamId: "team-a",
        playerId: "team-a-p1", // handicap 0
        holeNumber: 1,
        strokes: 12, // +8
      },
      ...PLAYERS.filter((p) => p.teamId === "team-a" && p.id !== "team-a-p1").map(
        (p) => ({
          teamId: "team-a",
          playerId: p.id,
          holeNumber: 1,
          strokes: 20,
        })
      ),
    ];
    const rows = computeLeaderboard(input({ format: "stableford", scores }));
    const alpha = rows.find((r) => r.teamId === "team-a")!;
    expect(alpha.holeDetails[0].value).toBe(0);
  });
});

describe("ranking and ties", () => {
  it("assigns standard competition ranking 1, T2, T2, 4", () => {
    const teams = [
      { id: "t1", name: "One" },
      { id: "t2", name: "Two" },
      { id: "t3", name: "Three" },
      { id: "t4", name: "Four" },
    ];
    const scores = [
      ...teamScores("t1", 18, -2),
      ...teamScores("t2", 18, 0),
      ...teamScores("t3", 18, 0),
      ...teamScores("t4", 18, 1),
    ].map((s) => s); // teamScores works for any id
    const rows = computeLeaderboard(
      input({ teams, players: [], scores })
    );
    expect(rows.map((r) => [r.position, r.tied])).toEqual([
      [1, false],
      [2, true],
      [2, true],
      [4, false],
    ]);
  });
});
