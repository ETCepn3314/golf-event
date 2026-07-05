import type { Hole, HoleDetail, Player } from "../types";

/**
 * Aggregate stroke play: team hole score is the sum of all players' gross strokes.
 * A hole is complete only when every player on the team has a score.
 */
export function strokeHoleDetails(
  holes: Hole[],
  players: Player[],
  playerScores: Map<string, Map<number, number>>
): HoleDetail[] {
  return holes.map((hole) => {
    const playerStrokes = players.map((p) => ({
      playerId: p.id,
      strokes: playerScores.get(p.id)?.get(hole.holeNumber) ?? null,
    }));
    const complete =
      players.length > 0 && playerStrokes.every((ps) => ps.strokes !== null);
    const sum = complete
      ? playerStrokes.reduce((acc, ps) => acc + (ps.strokes as number), 0)
      : null;
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      complete,
      value: sum,
      vsPar: sum !== null ? sum - hole.par * players.length : null,
      playerStrokes,
    };
  });
}
