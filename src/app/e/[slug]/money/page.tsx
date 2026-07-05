"use client";

import { use } from "react";
import { Card } from "@/components/ui";
import { formatMoney, useLeaderboard } from "@/lib/client/useLeaderboard";

export default function MoneyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error } = useLeaderboard(slug, 15000);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-red-700">Event not found</h1>
        <p className="mt-2 text-slate-600">{error}</p>
      </main>
    );
  }
  if (!data) {
    return <main className="p-8 text-center text-slate-500">Loading…</main>;
  }

  const payoutByTeam = new Map(data.payouts.map((p) => [p.teamId, p]));
  const teamCount = data.leaderboard.length;
  const entryFee = teamCount > 0 ? data.pot / teamCount : 0;
  const contestTotal = data.contests.reduce((a, c) => a + c.prizeAmount, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-5">
      <header className="mb-4">
        <h1 className="text-2xl font-bold text-emerald-900">{data.event.name} — Money</h1>
        <p className="text-sm text-slate-500">
          {data.payoutsFinal
            ? "Final results"
            : "Projected from the live leaderboard — not final until the organizer finalizes the event."}
        </p>
      </header>

      <Card className="mb-4">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">The pot</h2>
        <div className="flex justify-between text-sm">
          <span>{teamCount} teams × {formatMoney(entryFee)} entry</span>
          <span className="font-bold">{formatMoney(data.pot)}</span>
        </div>
        {contestTotal > 0 && (
          <div className="mt-1 flex justify-between text-sm text-slate-500">
            <span>Side contest prizes (separate)</span>
            <span>{formatMoney(contestTotal)}</span>
          </div>
        )}
      </Card>

      <Card className="mb-4 !p-0 overflow-hidden">
        <h2 className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Place payouts {data.payoutsFinal ? "" : "(projected)"}
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {data.payouts.length === 0 && (
              <tr><td className="px-4 py-3 text-slate-500">No payouts yet — waiting on scores.</td></tr>
            )}
            {data.payouts.map((p) => (
              <tr key={p.teamId} className="border-b border-emerald-50 last:border-0">
                <td className="px-4 py-3 font-bold text-emerald-900">{p.placeLabel}</td>
                <td className="px-2 py-3 font-semibold">{p.teamName}</td>
                <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                  {formatMoney(p.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {data.contests.length > 0 && (
        <Card className="mb-4 !p-0 overflow-hidden">
          <h2 className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Side contests
          </h2>
          <table className="w-full text-sm">
            <tbody>
              {data.contests.map((c) => (
                <tr key={c.id} className="border-b border-emerald-50 last:border-0">
                  <td className="px-4 py-3 font-semibold">{c.name}</td>
                  <td className="px-2 py-3 text-slate-600">{c.winnerName ?? "—"}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-700 tabular-nums">
                    {formatMoney(c.prizeAmount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card className="!p-0 overflow-hidden">
        <h2 className="border-b border-emerald-100 bg-emerald-50/50 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Per-team net (winnings − entry)
        </h2>
        <table className="w-full text-sm">
          <tbody>
            {data.leaderboard.map((row) => {
              const winnings = payoutByTeam.get(row.teamId)?.amount ?? 0;
              const net = winnings - entryFee;
              return (
                <tr key={row.teamId} className="border-b border-emerald-50 last:border-0">
                  <td className="px-4 py-3 font-semibold">{row.teamName}</td>
                  <td
                    className={`px-4 py-3 text-right font-bold tabular-nums ${
                      net > 0 ? "text-emerald-700" : net < 0 ? "text-red-600" : "text-slate-500"
                    }`}
                  >
                    {net >= 0 ? "+" : "−"}{formatMoney(Math.abs(net))}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <div className="mt-6 text-center">
        <a href={`/e/${slug}`} className="text-sm font-semibold text-emerald-700 underline">
          ← Back to leaderboard
        </a>
      </div>
    </main>
  );
}
