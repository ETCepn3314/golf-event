import { bestBallHoleDetails } from "./formats/bestBall";
import { scrambleHoleDetails } from "./formats/scramble";
import { stablefordHoleDetails } from "./formats/stableford";
import { strokeHoleDetails } from "./formats/stroke";
import type {
  HoleDetail,
  LeaderboardInput,
  LeaderboardRow,
} from "./types";

export function computeLeaderboard(input: LeaderboardInput): LeaderboardRow[] {
  const holes = [...input.holes].sort((a, b) => a.holeNumber - b.holeNumber);

  const rows = input.teams.map((team) => {
    const teamPlayers = input.players.filter((p) => p.teamId === team.id);
    const teamScores = new Map<number, number>();
    const playerScores = new Map<string, Map<number, number>>();
    for (const s of input.scores) {
      if (s.teamId !== team.id) continue;
      if (s.playerId === null) {
        teamScores.set(s.holeNumber, s.strokes);
      } else {
        let m = playerScores.get(s.playerId);
        if (!m) {
          m = new Map();
          playerScores.set(s.playerId, m);
        }
        m.set(s.holeNumber, s.strokes);
      }
    }

    let holeDetails: HoleDetail[];
    switch (input.format) {
      case "scramble":
        holeDetails = scrambleHoleDetails(holes, teamScores);
        break;
      case "stroke":
        holeDetails = strokeHoleDetails(holes, teamPlayers, playerScores);
        break;
      case "best_ball":
        holeDetails = bestBallHoleDetails(
          holes,
          teamPlayers,
          playerScores,
          input.config
        );
        break;
      case "stableford":
        holeDetails = stablefordHoleDetails(
          holes,
          teamPlayers,
          playerScores,
          input.config
        );
        break;
    }

    const played = holeDetails.filter((h) => h.complete);
    const total = played.reduce((acc, h) => acc + (h.value as number), 0);
    const vsPar =
      input.format === "stableford"
        ? null
        : played.reduce((acc, h) => acc + (h.vsPar as number), 0);

    return {
      teamId: team.id,
      teamName: team.name,
      position: 0,
      tied: false,
      thru: played.length,
      total,
      vsPar,
      holeDetails,
    };
  });

  return rankRows(rows, input.format === "stableford");
}

/**
 * Sort and assign standard competition ranking (1, T2, T2, 4).
 * Stroke formats rank by vsPar ascending (fair across teams thru different
 * holes); stableford ranks by points descending. Teams with no holes played
 * sort to the bottom.
 */
function rankRows(
  rows: LeaderboardRow[],
  higherIsBetter: boolean
): LeaderboardRow[] {
  const sortKey = (r: LeaderboardRow) => {
    if (r.thru === 0) return Number.POSITIVE_INFINITY;
    const key = higherIsBetter ? -r.total : (r.vsPar as number);
    return key;
  };
  const sorted = [...rows].sort(
    (a, b) => sortKey(a) - sortKey(b) || a.teamName.localeCompare(b.teamName)
  );

  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sortKey(sorted[i]) === sortKey(sorted[i - 1])) {
      sorted[i].position = sorted[i - 1].position;
    } else {
      sorted[i].position = i + 1;
    }
  }
  for (const row of sorted) {
    row.tied = sorted.some((o) => o !== row && o.position === row.position);
  }
  return sorted;
}
