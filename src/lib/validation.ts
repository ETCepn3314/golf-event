import { z } from "zod";

export const payoutConfigSchema = z.object({
  type: z.enum(["percentage", "fixed"]),
  places: z.array(z.number().nonnegative()).min(1).max(10),
});

export const eventConfigSchema = z.object({
  entryFeePerTeam: z.number().nonnegative().default(0),
  payout: payoutConfigSchema.default({ type: "percentage", places: [50, 30, 20] }),
  holesToPlay: z.union([z.literal(9), z.literal(18)]).default(18),
  stableford: z
    .object({ points: z.record(z.string(), z.number()) })
    .optional(),
  bestBall: z
    .object({
      countBestN: z.number().int().min(1).max(4).default(2),
      handicapAllowancePct: z.number().min(0).max(100).default(100),
    })
    .optional(),
});

export const formatSchema = z.enum([
  "scramble",
  "stroke",
  "best_ball",
  "stableford",
]);

const holeSchema = z.object({
  holeNumber: z.number().int().min(1).max(18),
  par: z.number().int().min(3).max(6),
  strokeIndex: z.number().int().min(1).max(18).nullable().optional(),
});

const playerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  handicap: z.number().min(0).max(54).default(0),
});

const teamSchema = z.object({
  name: z.string().trim().min(1).max(60),
  players: z.array(playerSchema).max(6),
});

const contestSchema = z.object({
  name: z.string().trim().min(1).max(80),
  prizeAmount: z.number().nonnegative(),
});

export const createEventSchema = z.object({
  name: z.string().trim().min(1).max(80),
  eventDate: z.string().date().nullable().optional(),
  format: formatSchema,
  config: eventConfigSchema,
  holes: z.array(holeSchema).min(1).max(18),
  teams: z.array(teamSchema).min(1).max(40),
  contests: z.array(contestSchema).max(20).default([]),
});

export const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  status: z.enum(["setup", "live", "final"]).optional(),
  config: eventConfigSchema.optional(),
});

export const upsertTeamSchema = z.object({
  name: z.string().trim().min(1).max(60),
  players: z
    .array(playerSchema.extend({ id: z.string().uuid().optional() }))
    .max(6),
});

export const submitScoresSchema = z.object({
  entries: z
    .array(
      z.object({
        holeNumber: z.number().int().min(1).max(18),
        playerId: z.string().uuid().nullable(),
        strokes: z.number().int().min(1).max(20).nullable(), // null clears a score
      })
    )
    .min(1)
    .max(90),
  /** Organizer corrections specify the team explicitly. */
  teamId: z.string().uuid().optional(),
});

export const setContestWinnerSchema = z.object({
  winnerName: z.string().trim().max(80).nullable(),
});
