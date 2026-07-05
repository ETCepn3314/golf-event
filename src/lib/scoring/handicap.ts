/**
 * Strokes a player receives on a hole, per standard allocation:
 * one stroke on every hole whose stroke index <= effective handicap (mod 18),
 * an additional stroke on every hole for each full 18 in the handicap.
 * e.g. handicap 22 -> 1 stroke on all 18 holes plus a 2nd stroke on SI 1-4.
 */
export function strokesReceived(
  handicap: number,
  strokeIndex: number | null | undefined,
  allowancePct = 100
): number {
  if (strokeIndex == null) return 0;
  const effective = Math.round(handicap * (allowancePct / 100));
  if (effective <= 0) return 0;
  const base = Math.floor(effective / 18);
  const remainder = effective % 18;
  return base + (strokeIndex <= remainder ? 1 : 0);
}
