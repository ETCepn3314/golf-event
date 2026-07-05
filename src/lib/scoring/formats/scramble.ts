import type { Hole, HoleDetail } from "../types";

/** One team score per hole. A hole is complete when the team score exists. */
export function scrambleHoleDetails(
  holes: Hole[],
  teamScores: Map<number, number>
): HoleDetail[] {
  return holes.map((hole) => {
    const strokes = teamScores.get(hole.holeNumber);
    const complete = strokes !== undefined;
    return {
      holeNumber: hole.holeNumber,
      par: hole.par,
      complete,
      value: complete ? strokes : null,
      vsPar: complete ? strokes - hole.par : null,
      playerStrokes: [],
    };
  });
}
