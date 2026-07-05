import type { LeaderboardRow, PayoutConfig, PayoutRow } from "./types";

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[n % 10] ?? "th";
  return `${n}${suffix}`;
}

/**
 * Dollar amounts per place (in cents), best place first. For percentage payouts
 * that sum to exactly 100, rounding remainders are folded into 1st place so the
 * amounts always sum to the exact pot.
 */
function placeAmountsCents(pot: number, payout: PayoutConfig): number[] {
  const potCents = Math.round(pot * 100);
  if (payout.type === "fixed") {
    return payout.places.map((amt) => Math.round(amt * 100));
  }
  const cents = payout.places.map((pct) => Math.round((potCents * pct) / 100));
  const pctTotal = payout.places.reduce((a, b) => a + b, 0);
  if (pctTotal === 100 && cents.length > 0) {
    const diff = potCents - cents.reduce((a, b) => a + b, 0);
    cents[0] += diff;
  }
  return cents;
}

/**
 * Distribute place money over the ranked leaderboard. Tied teams split the sum
 * of the payouts for the places they occupy, rounded to cents, with any
 * remainder cents going to the teams listed first so the total always balances.
 */
export function computePayouts(
  pot: number,
  payout: PayoutConfig,
  rows: LeaderboardRow[]
): PayoutRow[] {
  const amounts = placeAmountsCents(pot, payout);
  const result: PayoutRow[] = [];

  let i = 0;
  while (i < rows.length) {
    const group = rows.filter((r) => r.position === rows[i].position);
    const k = group.length;
    const place = rows[i].position; // 1-based place of the whole tie group

    if (place > amounts.length) break;

    const groupTotal = amounts
      .slice(place - 1, place - 1 + k)
      .reduce((a, b) => a + b, 0);
    if (groupTotal > 0) {
      const share = Math.floor(groupTotal / k);
      let remainder = groupTotal - share * k;
      for (const row of group) {
        const cents = share + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder--;
        result.push({
          teamId: row.teamId,
          teamName: row.teamName,
          placeLabel: k > 1 ? `T${place}` : ordinal(place),
          amount: cents / 100,
        });
      }
    }
    i += k;
  }
  return result;
}
