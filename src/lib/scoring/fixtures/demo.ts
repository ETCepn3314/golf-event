import type {
  EventConfig,
  Hole,
  Player,
  RawScore,
  Team,
} from "../types";

/** 18-hole par-72 course; stroke index 1 on hole 1, 2 on hole 2, etc. for easy math. */
export const HOLES: Hole[] = Array.from({ length: 18 }, (_, i) => ({
  holeNumber: i + 1,
  par: [4, 5, 3, 4, 4, 5, 3, 4, 4, 4, 5, 3, 4, 4, 5, 3, 4, 4][i],
  strokeIndex: i + 1,
}));

export const TEAMS: Team[] = [
  { id: "team-a", name: "Alpha" },
  { id: "team-b", name: "Bravo" },
  { id: "team-c", name: "Charlie" },
];

export const PLAYERS: Player[] = TEAMS.flatMap((team) =>
  Array.from({ length: 4 }, (_, i) => ({
    id: `${team.id}-p${i + 1}`,
    teamId: team.id,
    name: `${team.name} Player ${i + 1}`,
    handicap: [0, 9, 18, 22][i], // one of each interesting handicap per team
  }))
);

export const BASE_CONFIG: EventConfig = {
  entryFeePerTeam: 100,
  payout: { type: "percentage", places: [50, 30, 20] },
  holesToPlay: 18,
};

/** Team scores (scramble style) for the first `thru` holes: par + offset on every hole. */
export function teamScores(
  teamId: string,
  thru: number,
  offset: number
): RawScore[] {
  return HOLES.slice(0, thru).map((h) => ({
    teamId,
    playerId: null,
    holeNumber: h.holeNumber,
    strokes: h.par + offset,
  }));
}

/** Player scores for the first `thru` holes: par + offset for every player on the team. */
export function playerScores(
  teamId: string,
  thru: number,
  offset: number
): RawScore[] {
  return PLAYERS.filter((p) => p.teamId === teamId).flatMap((p) =>
    HOLES.slice(0, thru).map((h) => ({
      teamId,
      playerId: p.id,
      holeNumber: h.holeNumber,
      strokes: h.par + offset,
    }))
  );
}
