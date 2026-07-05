import { strokesReceived } from "../handicap";
import type { EventConfig, Hole, HoleDetail, Player } from "../types";

/**
 * Best ball / net: each player's net score per hole (gross - handicap strokes),
 * team hole score is the sum of the best N nets. A hole is complete only when
 * every player on the team has a score.
 */
export function bestBallHoleDetails(
  holes: Hole[],
  players: Player[],
  playerScores: Map<string, Map<number, number>>,
  config: EventConfig
): HoleDetail[] {
  const countBestN = Math.min(
    config.bestBall?.countBestN ?? 1,
    Math.max(players.length, 1)
  );
  const allowance = config.bestBall?.handicapAllowancePct ?? 100;

  return holes.map((hole) => {
    const playerStrokes = players.map((p) => ({
      playerId: p.id,
      strokes: playerScores.get(p.id)?.get(hole.holeNumber) ?? null,
    }));
    const complete =
      players.length > 0 && playerStrokes.every((ps) => ps.strokes !== null);

    let value: number | null = null;
    if (complete) {
      const nets = players.map((p, i) => {
        const gross = playerStrokes[i].strokes as number;
        return gross - strokesReceived(p.handicap, hole.strokeIndex, allowance);
      });
      nets.sort((a, b) => a - b);
      value = nets.slice(0, countBestN).reduce((acc, n) => acc + n, 0);
    }

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      complete,
      value,
      vsPar: value !== null ? value - hole.par * countBestN : null,
      playerStrokes,
    };
  });
}
