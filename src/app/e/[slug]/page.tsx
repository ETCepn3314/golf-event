"use client";

import { use, useEffect, useState } from "react";
import { Card } from "@/components/ui";
import {
  formatMoney,
  formatVsPar,
  useLeaderboard,
} from "@/lib/client/useLeaderboard";

export default function LeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error, lastUpdated } = useLeaderboard(slug);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [ago, setAgo] = useState("");

  useEffect(() => {
    const t = setInterval(() => {
      if (lastUpdated) setAgo(`updated ${Math.round((Date.now() - lastUpdated) / 1000)}s ago`);
    }, 1000);
    return () => clearInterval(t);
  }, [lastUpdated]);

  if (error) {
    return (
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-red-700">Event not found</h1>
        <p className="mt-2 text-slate-600">{error}</p>
      </main>
    );
  }
  if (!data) {
    return <main className="p-8 text-center text-slate-500">Loading leaderboard…</main>;
  }

  const isStableford = data.event.format === "stableford";
  const payoutByTeam = new Map(data.payouts.map((p) => [p.teamId, p]));
  const playersByTeam = new Map<string, { id: string; name: string }[]>();
  for (const p of data.players) {
    const list = playersByTeam.get(p.teamId) ?? [];
    list.push(p);
    playersByTeam.set(p.teamId, list);
  }

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-5">
      <header className="mb-4 px-1">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-emerald-900">{data.event.name}</h1>
          {data.event.status === "final" ? (
            <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-bold text-white">FINAL</span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> LIVE
            </span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-sm text-slate-500">
          <span>
            Pot {formatMoney(data.pot)} · {data.payoutsFinal ? "final payouts" : "projected payouts"}
          </span>
          <span className="text-xs">{ago}</span>
        </div>
      </header>

      <Card className="!p-0 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-emerald-100 bg-emerald-50/50 text-left text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2">Pos</th>
              <th className="px-2 py-2">Team</th>
              <th className="px-2 py-2 text-center">Thru</th>
              <th className="px-2 py-2 text-right">{isStableford ? "Pts" : "Score"}</th>
              <th className="px-3 py-2 text-right">$</th>
            </tr>
          </thead>
          <tbody>
            {data.leaderboard.map((row) => {
              const payout = payoutByTeam.get(row.teamId);
              const isOpen = expanded === row.teamId;
              return (
                <RowGroup
                  key={row.teamId}
                  row={row}
                  payout={payout}
                  isStableford={isStableford}
                  isOpen={isOpen}
                  players={playersByTeam.get(row.teamId) ?? []}
                  onToggle={() => setExpanded(isOpen ? null : row.teamId)}
                />
              );
            })}
          </tbody>
        </table>
      </Card>

      {data.contests.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-2 px-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Side contests
          </h2>
          <div className="space-y-2">
            {data.contests.map((c) => (
              <Card key={c.id} className="flex items-center justify-between !p-3">
                <div>
                  <div className="font-semibold">{c.name}</div>
                  <div className="text-sm text-slate-500">
                    {c.winnerName ? `Winner: ${c.winnerName}` : "Not decided yet"}
                  </div>
                </div>
                <span className="font-bold text-emerald-800">{formatMoney(c.prizeAmount)}</span>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6 text-center">
        <a href={`/e/${slug}/money`} className="text-sm font-semibold text-emerald-700 underline">
          Full money breakdown →
        </a>
      </div>
    </main>
  );
}

function RowGroup({
  row,
  payout,
  isStableford,
  isOpen,
  players,
  onToggle,
}: {
  row: {
    teamId: string;
    teamName: string;
    position: number;
    tied: boolean;
    thru: number;
    total: number;
    vsPar: number | null;
    holeDetails: {
      holeNumber: number;
      par: number;
      complete: boolean;
      value: number | null;
      playerStrokes: { playerId: string; strokes: number | null }[];
    }[];
  };
  payout?: { amount: number };
  isStableford: boolean;
  isOpen: boolean;
  players: { id: string; name: string }[];
  onToggle: () => void;
}) {
  const scoreText = isStableford ? String(row.total) : formatVsPar(row.vsPar);
  const scoreColor =
    !isStableford && row.vsPar !== null && row.vsPar < 0 ? "text-red-600" : "text-slate-900";
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "";

  return (
    <>
      <tr className="cursor-pointer border-b border-emerald-50 active:bg-emerald-50" onClick={onToggle}>
        <td className="px-3 py-3 font-bold text-emerald-900">
          {row.thru === 0 ? "–" : `${row.tied ? "T" : ""}${row.position}`}
        </td>
        <td className="px-2 py-3 font-semibold">{row.teamName}</td>
        <td className="px-2 py-3 text-center text-slate-500">{row.thru === 0 ? "–" : row.thru}</td>
        <td className={`px-2 py-3 text-right text-lg font-bold tabular-nums ${scoreColor}`}>
          {row.thru === 0 ? "–" : scoreText}
        </td>
        <td className="px-3 py-3 text-right font-semibold text-emerald-700 tabular-nums">
          {payout ? formatMoney(payout.amount) : ""}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-emerald-50 bg-emerald-50/40">
          <td colSpan={5} className="px-3 py-3">
            <div className="overflow-x-auto">
              <table className="text-xs tabular-nums">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pr-2 text-left font-medium">Hole</th>
                    {row.holeDetails.map((h) => (
                      <th key={h.holeNumber} className="w-7 text-center font-medium">{h.holeNumber}</th>
                    ))}
                  </tr>
                  <tr className="text-slate-400">
                    <th className="pr-2 text-left font-medium">Par</th>
                    {row.holeDetails.map((h) => (
                      <th key={h.holeNumber} className="w-7 text-center font-medium">{h.par}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.holeDetails.some((h) => h.playerStrokes.length > 0) ? (
                    players.map((p) => (
                      <tr key={p.id}>
                        <td className="pr-2 font-medium text-slate-600">{playerName(p.id)}</td>
                        {row.holeDetails.map((h) => {
                          const ps = h.playerStrokes.find((x) => x.playerId === p.id);
                          return (
                            <td key={h.holeNumber} className="text-center">
                              {ps?.strokes ?? "·"}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="pr-2 font-medium text-slate-600">Score</td>
                      {row.holeDetails.map((h) => (
                        <td key={h.holeNumber} className="text-center font-semibold">
                          {h.complete ? h.value : "·"}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr className="font-semibold text-emerald-900">
                    <td className="pr-2">{isStableford ? "Pts" : "Team"}</td>
                    {row.holeDetails.map((h) => (
                      <td key={h.holeNumber} className="text-center">
                        {h.complete ? h.value : "·"}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
