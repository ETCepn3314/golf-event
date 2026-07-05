import { strokesReceived } from "../handicap";
import type { EventConfig, Hole, HoleDetail, Player } from "../types";

export const DEFAULT_STABLEFORD_POINTS: Record<string, number> = {
  "-3": 5,
  "-2": 4,
  "-1": 3,
  "0": 2,
  "1": 1,
  "2": 0,
};

/**
 * Points from a net-vs-par diff using the event's points table.
 * Diffs below the lowest configured key use the lowest key's value;
 * diffs above the highest key score 0.
 */
export function pointsForDiff(
  diff: number,
  table: Record<string, number>
): number {
  const keys = Object.keys(table).map(Number);
  const min = Math.min(...keys);
  const max = Math.max(...keys);
  if (diff < min) return table[String(min)];
  if (diff > max) return 0;
  return table[String(diff)] ?? 0;
}

/**
 * Stableford: each player earns points per hole from net score vs par; the team
 * hole score is the sum of all players' points. Handicaps apply when the course
 * has stroke indexes; otherwise it is gross stableford.
 */
export function stablefordHoleDetails(
  holes: Hole[],
  players: Player[],
  playerScores: Map<string, Map<number, number>>,
  config: EventConfig
): HoleDetail[] {
  const table = config.stableford?.points ?? DEFAULT_STABLEFORD_POINTS;

  return holes.map((hole) => {
    const playerStrokes = players.map((p) => ({
      playerId: p.id,
      strokes: playerScores.get(p.id)?.get(hole.holeNumber) ?? null,
    }));
    const complete =
      players.length > 0 && playerStrokes.every((ps) => ps.strokes !== null);

    let value: number | null = null;
    if (complete) {
      value = players.reduce((acc, p, i) => {
        const gross = playerStrokes[i].strokes as number;
        const net = gross - strokesReceived(p.handicap, hole.strokeIndex);
        return acc + pointsForDiff(net - hole.par, table);
      }, 0);
    }

    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      complete,
      value,
      vsPar: null,
      playerStrokes,
    };
  });
}
