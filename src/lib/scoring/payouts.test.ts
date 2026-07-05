import { describe, expect, it } from "vitest";
import { computePayouts } from "./payouts";
import type { LeaderboardRow, PayoutConfig } from "./types";

function row(teamId: string, position: number, tied = false): LeaderboardRow {
  return {
    teamId,
    teamName: teamId,
    position,
    tied,
    thru: 18,
    total: 72,
    vsPar: 0,
    holeDetails: [],
  };
}

const pct502030: PayoutConfig = { type: "percentage", places: [50, 30, 20] };

describe("computePayouts", () => {
  it("pays a clean 50/30/20 split", () => {
    const rows = [row("a", 1), row("b", 2), row("c", 3), row("d", 4)];
    const payouts = computePayouts(1000, pct502030, rows);
    expect(payouts).toEqual([
      { teamId: "a", teamName: "a", placeLabel: "1st", amount: 500 },
      { teamId: "b", teamName: "b", placeLabel: "2nd", amount: 300 },
      { teamId: "c", teamName: "c", placeLabel: "3rd", amount: 200 },
    ]);
  });

  it("splits a 2-way tie for 1st across 1st+2nd money", () => {
    const rows = [row("a", 1, true), row("b", 1, true), row("c", 3)];
    const payouts = computePayouts(1000, pct502030, rows);
    expect(payouts[0]).toMatchObject({ teamId: "a", placeLabel: "T1", amount: 400 });
    expect(payouts[1]).toMatchObject({ teamId: "b", placeLabel: "T1", amount: 400 });
    expect(payouts[2]).toMatchObject({ teamId: "c", placeLabel: "3rd", amount: 200 });
  });

  it("splits a 3-way tie for 2nd across only the remaining paid places", () => {
    const rows = [row("a", 1), row("b", 2, true), row("c", 2, true), row("d", 2, true)];
    const payouts = computePayouts(1000, pct502030, rows);
    // 2nd+3rd money = 500 across 3 teams
    expect(payouts[0].amount).toBe(500);
    const tieAmounts = payouts.slice(1).map((p) => p.amount);
    expect(tieAmounts.reduce((a, b) => a + b, 0)).toBeCloseTo(500, 10);
    // uneven cents go to the first-listed teams
    expect(tieAmounts).toEqual([166.67, 166.67, 166.66]);
  });

  it("always sums to the exact pot when percentages sum to 100", () => {
    const rows = [row("a", 1, true), row("b", 1, true), row("c", 1, true)];
    const pot = 333.33;
    const payouts = computePayouts(
      pot,
      { type: "percentage", places: [50, 30, 20] },
      rows
    );
    const totalCents = payouts.reduce((a, p) => a + Math.round(p.amount * 100), 0);
    expect(totalCents).toBe(Math.round(pot * 100));
  });

  it("supports fixed-amount payouts", () => {
    const rows = [row("a", 1), row("b", 2)];
    const payouts = computePayouts(
      0,
      { type: "fixed", places: [150, 50] },
      rows
    );
    expect(payouts[0].amount).toBe(150);
    expect(payouts[1].amount).toBe(50);
  });

  it("handles more paid places than teams", () => {
    const rows = [row("a", 1)];
    const payouts = computePayouts(100, pct502030, rows);
    expect(payouts).toHaveLength(1);
    expect(payouts[0].amount).toBe(50);
  });
});
