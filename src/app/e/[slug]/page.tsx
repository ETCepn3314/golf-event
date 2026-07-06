"use client";

import { use, useEffect, useState } from "react";
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
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-clay">Event not found</h1>
        <p className="mt-2 text-putty">{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="p-10 text-center text-sm uppercase tracking-[0.2em] text-putty">
        Loading the board…
      </main>
    );
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
    <main className="mx-auto w-full max-w-2xl flex-1 px-3 py-6 sm:px-4">
      <header className="mb-5 px-1">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
              Official leaderboard
            </div>
            <h1 className="mt-1 font-display text-[1.9rem] font-semibold leading-tight text-pine">
              {data.event.name}
            </h1>
          </div>
          {data.event.status === "final" ? (
            <span className="mt-1 rounded-sm border border-ink/25 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-ink">
              Final
            </span>
          ) : (
            <span className="mt-1 flex items-center gap-1.5 rounded-sm bg-clay px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-cream">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cream" />
              Live
            </span>
          )}
        </div>
        <div className="mt-2 flex items-center justify-between text-[13px] text-putty">
          <span>
            Purse {formatMoney(data.pot)} · {data.payoutsFinal ? "final" : "projected"}
          </span>
          <span className="text-xs">{ago}</span>
        </div>
      </header>

      {/* The board */}
      <div className="board-texture overflow-hidden rounded-md bg-pine text-cream shadow-[0_18px_40px_-18px_rgba(15,42,31,0.55)]">
        <table className="w-full table-fixed text-sm">
          <thead>
            <tr className="border-b border-cream/15 text-left text-[10px] uppercase tracking-[0.16em] text-cream/50">
              <th className="w-11 px-2 py-3 sm:w-14 sm:px-4">Pos</th>
              <th className="px-1 py-3">Team</th>
              <th className="w-10 px-1 py-3 text-center sm:w-14">Thru</th>
              <th className="w-13 px-1 py-3 text-right sm:w-16">{isStableford ? "Pts" : "Score"}</th>
              <th className="w-16 px-2 py-3 text-right sm:w-20 sm:px-4">Purse</th>
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
      </div>
      <p className="mt-2 px-1 text-right text-[11px] uppercase tracking-[0.16em] text-putty">
        Tap a row for the full card
      </p>

      {data.event.rulesNotes && (
        <section className="mt-6 rounded-md border border-brass/40 bg-brass/5 px-4 py-3.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brass">
            Tournament rules
          </h2>
          <p className="mt-1.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink/80">
            {data.event.rulesNotes}
          </p>
        </section>
      )}

      {data.contests.length > 0 && (
        <section className="mt-8">
          <h2 className="px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
            Side contests
          </h2>
          <div className="mt-3 divide-y divide-ink/10 rounded-md border border-ink/10 bg-paper">
            {data.contests.map((c) => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3.5">
                <div>
                  <div className="font-semibold text-ink">{c.name}</div>
                  <div className="mt-0.5 text-[13px] text-putty">
                    {c.winnerName ? `Winner — ${c.winnerName}` : "Undecided"}
                  </div>
                </div>
                <span className="font-display text-lg font-semibold text-brass">
                  {formatMoney(c.prizeAmount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="mt-8 text-center">
        <a
          href={`/e/${slug}/money`}
          className="text-[12px] font-semibold uppercase tracking-[0.18em] text-pine underline decoration-brass decoration-2 underline-offset-4 hover:text-moss"
        >
          Full money breakdown
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
  // Golf tradition: red numerals for under par.
  const scoreColor =
    !isStableford && row.vsPar !== null && row.vsPar < 0
      ? "text-[#ff8a70]"
      : "text-cream";
  const playerName = (id: string) => players.find((p) => p.id === id)?.name ?? "";

  return (
    <>
      <tr
        className={`cursor-pointer border-b border-cream/10 transition-colors ${isOpen ? "bg-cream/5" : "hover:bg-cream/5"}`}
        onClick={onToggle}
      >
        <td className="px-2 py-3.5 sm:px-4">
          <span className="font-display text-lg font-semibold text-brass-light">
            {row.thru === 0 ? "–" : `${row.tied ? "T" : ""}${row.position}`}
          </span>
        </td>
        <td className="truncate px-1 py-3.5 text-[13px] font-semibold tracking-wide sm:text-sm">
          {row.teamName}
        </td>
        <td className="px-1 py-3.5 text-center text-cream/55 tabular-nums">
          {row.thru === 0 ? "–" : row.thru}
        </td>
        <td className={`px-1 py-3.5 text-right font-display text-lg font-semibold tabular-nums sm:text-xl ${scoreColor}`}>
          {row.thru === 0 ? "–" : scoreText}
        </td>
        <td className="truncate px-2 py-3.5 text-right text-[13px] font-semibold text-brass-light tabular-nums sm:px-4 sm:text-sm">
          {payout ? formatMoney(payout.amount) : ""}
        </td>
      </tr>
      {isOpen && (
        <tr className="border-b border-cream/10 bg-[#0b2018]">
          <td colSpan={5} className="px-3 py-4 sm:px-4">
            <div className="overflow-x-auto">
              <table className="text-xs tabular-nums">
                <thead>
                  <tr className="text-cream/40">
                    <th className="pr-3 text-left font-medium uppercase tracking-wider">Hole</th>
                    {row.holeDetails.map((h) => (
                      <th key={h.holeNumber} className="w-7 text-center font-medium">
                        {h.holeNumber}
                      </th>
                    ))}
                  </tr>
                  <tr className="text-cream/40">
                    <th className="pr-3 text-left font-medium uppercase tracking-wider">Par</th>
                    {row.holeDetails.map((h) => (
                      <th key={h.holeNumber} className="w-7 text-center font-medium">
                        {h.par}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {row.holeDetails.some((h) => h.playerStrokes.length > 0) ? (
                    players.map((p) => (
                      <tr key={p.id} className="text-cream/85">
                        <td className="whitespace-nowrap pr-3 font-medium text-cream/60">
                          {playerName(p.id)}
                        </td>
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
                    <tr className="text-cream/85">
                      <td className="pr-3 font-medium text-cream/60">Score</td>
                      {row.holeDetails.map((h) => (
                        <td key={h.holeNumber} className="text-center font-semibold">
                          {h.complete ? h.value : "·"}
                        </td>
                      ))}
                    </tr>
                  )}
                  <tr className="font-semibold text-brass-light">
                    <td className="pr-3 uppercase tracking-wider">{isStableford ? "Pts" : "Team"}</td>
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
