"use client";

import { use, useEffect } from "react";
import { EventNav } from "@/components/EventNav";
import { rememberEvent } from "@/lib/client/recentEvents";
import { formatMoney, useLeaderboard } from "@/lib/client/useLeaderboard";

export default function MoneyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { data, error } = useLeaderboard(slug, 15000);

  useEffect(() => {
    if (data?.event.name) rememberEvent({ slug, name: data.event.name });
  }, [slug, data?.event.name]);

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
        Loading…
      </main>
    );
  }

  const payoutByTeam = new Map(data.payouts.map((p) => [p.teamId, p]));
  const teamCount = data.leaderboard.length;
  const entryFee = teamCount > 0 ? data.pot / teamCount : 0;
  const contestTotal = data.contests.reduce((a, c) => a + c.prizeAmount, 0);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-7">
      <EventNav slug={slug} active="money" />
      <header className="mb-6">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
          Settlement
        </div>
        <h1 className="mt-1 font-display text-[1.9rem] font-semibold leading-tight text-pine">
          {data.event.name}
        </h1>
        <p className="mt-1.5 text-[13px] text-putty">
          {data.payoutsFinal
            ? "Final results."
            : "Projected from the live board — not official until the organizer finalizes."}
        </p>
        <div className="rule-double mt-4" />
      </header>

      {/* The purse */}
      <div className="board-texture mb-5 rounded-md bg-pine p-5 text-cream">
        <div className="flex items-end justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-cream/60">The purse</div>
            <div className="mt-1 font-display text-4xl font-semibold text-brass-light">
              {formatMoney(data.pot)}
            </div>
            <div className="mt-1 text-[13px] text-cream/60">
              {teamCount} teams × {formatMoney(entryFee)} entry
            </div>
          </div>
          {contestTotal > 0 && (
            <div className="text-right">
              <div className="text-[11px] uppercase tracking-[0.2em] text-cream/60">Contests</div>
              <div className="mt-1 font-display text-xl font-semibold text-cream">
                {formatMoney(contestTotal)}
              </div>
            </div>
          )}
        </div>
      </div>

      <Section title={`Place payouts${data.payoutsFinal ? "" : " — projected"}`}>
        {data.payouts.length === 0 && (
          <div className="px-4 py-4 text-sm text-putty">No payouts yet — waiting on scores.</div>
        )}
        {data.payouts.map((p) => (
          <div key={p.teamId} className="flex items-center px-4 py-3.5">
            <span className="w-12 font-display text-lg font-semibold text-brass">{p.placeLabel}</span>
            <span className="flex-1 font-semibold text-ink">{p.teamName}</span>
            <span className="font-display text-lg font-semibold tabular-nums text-pine">
              {formatMoney(p.amount)}
            </span>
          </div>
        ))}
      </Section>

      {data.contests.length > 0 && (
        <Section title="Side contests">
          {data.contests.map((c) => (
            <div key={c.id} className="flex items-center px-4 py-3.5">
              <span className="flex-1 font-semibold text-ink">{c.name}</span>
              <span className="w-32 text-[13px] text-putty">{c.winnerName ?? "—"}</span>
              <span className="font-display text-lg font-semibold tabular-nums text-pine">
                {formatMoney(c.prizeAmount)}
              </span>
            </div>
          ))}
        </Section>
      )}

      <Section title="Per-team net (winnings − entry)">
        {data.leaderboard.map((row) => {
          const winnings = payoutByTeam.get(row.teamId)?.amount ?? 0;
          const net = winnings - entryFee;
          return (
            <div key={row.teamId} className="flex items-center justify-between px-4 py-3.5">
              <span className="font-semibold text-ink">{row.teamName}</span>
              <span
                className={`font-display text-lg font-semibold tabular-nums ${
                  net > 0 ? "text-fern" : net < 0 ? "text-clay" : "text-putty"
                }`}
              >
                {net >= 0 ? "+" : "−"}{formatMoney(Math.abs(net))}
              </span>
            </div>
          );
        })}
      </Section>

      <div className="mt-8 text-center">
        <a
          href={`/e/${slug}`}
          className="text-[12px] font-semibold uppercase tracking-[0.18em] text-pine underline decoration-brass decoration-2 underline-offset-4 hover:text-moss"
        >
          Back to leaderboard
        </a>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
        {title}
      </h2>
      <div className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-paper">
        {children}
      </div>
    </section>
  );
}
