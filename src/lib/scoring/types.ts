export type Format = "scramble" | "stroke" | "best_ball" | "stableford";

export interface PayoutConfig {
  type: "percentage" | "fixed";
  /** Percentages of the pot (e.g. [50, 30, 20]) or fixed dollar amounts, best place first. */
  places: number[];
}

export interface EventConfig {
  entryFeePerTeam: number;
  payout: PayoutConfig;
  holesToPlay: number;
  /** Points awarded per (net score - par). Keys are diffs as strings, e.g. "-2". Diffs below the
   * lowest key use the lowest key's value; diffs above the highest key score 0. */
  stableford?: { points: Record<string, number> };
  bestBall?: { countBestN: number; handicapAllowancePct: number };
  /** Free-text local rules shown to players; not used by the scoring engine. */
  rulesNotes?: string;
  /** Per-event visual theming (colors + logo); not used by the scoring engine. */
  branding?: {
    themeId?: string;
    brandColor?: string;
    accentColor?: string;
    logoUrl?: string;
  };
}

export interface Hole {
  holeNumber: number;
  par: number;
  strokeIndex?: number | null;
}

export interface Team {
  id: string;
  name: string;
  sortOrder?: number;
}

export interface Player {
  id: string;
  teamId: string;
  name: string;
  handicap: number;
}

export interface RawScore {
  teamId: string;
  /** null = team score (scramble); otherwise an individual player's score. */
  playerId: string | null;
  holeNumber: number;
  strokes: number;
}

export interface HoleDetail {
  holeNumber: number;
  par: number;
  complete: boolean;
  /** Contribution to the team total (strokes for stroke formats, points for stableford). */
  value: number | null;
  /** Contribution to the team's vs-par figure. null for stableford. */
  vsPar: number | null;
  /** Per-player raw strokes on this hole, for expanded leaderboard rows. */
  playerStrokes: { playerId: string; strokes: number | null }[];
}

export interface LeaderboardRow {
  teamId: string;
  teamName: string;
  position: number;
  tied: boolean;
  /** Number of holes with a complete score entry. */
  thru: number;
  total: number;
  /** Total relative to par over holes played. null for stableford. */
  vsPar: number | null;
  holeDetails: HoleDetail[];
}

export interface LeaderboardInput {
  format: Format;
  config: EventConfig;
  holes: Hole[];
  teams: Team[];
  players: Player[];
  scores: RawScore[];
}

export interface PayoutRow {
  teamId: string;
  teamName: string;
  placeLabel: string;
  amount: number;
}
