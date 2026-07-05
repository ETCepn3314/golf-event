"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import {
  enqueue,
  flushQueue,
  loadLocalScores,
  loadQueue,
  saveLocalScores,
  scoreKey,
  type SyncState,
} from "@/lib/client/scoreSync";

interface TeamInfo {
  event: { name: string; format: string; status: string };
  team: { id: string; name: string };
  players: { id: string; name: string; handicap: number }[];
  holes: { holeNumber: number; par: number; strokeIndex: number | null }[];
}

export default function ScoreEntryPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = use(params);
  const [info, setInfo] = useState<TeamInfo | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>(() =>
    typeof window === "undefined" ? {} : loadLocalScores(slug, code)
  );
  const [hole, setHole] = useState(1);
  const [sync, setSync] = useState<SyncState>("saved");
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const doFlush = useCallback(async () => {
    if (loadQueue(slug, code).length === 0) {
      setSync("saved");
      return;
    }
    setSync("saving");
    const empty = await flushQueue(slug, code);
    setSync(empty ? "saved" : "pending");
  }, [slug, code]);

  useEffect(() => {
    fetch(`/api/events/${slug}/team`, { headers: { "x-team-code": code } })
      .then(async (res) => {
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Error ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        setInfo(data);
        // Merge server scores under local ones (local edits win until flushed).
        setScores((local) => {
          const merged: Record<string, number> = {};
          for (const s of data.scores as { playerId: string | null; holeNumber: number; strokes: number }[]) {
            merged[scoreKey(s.playerId, s.holeNumber)] = s.strokes;
          }
          const queued = new Set(
            loadQueue(slug, code).map((q) => scoreKey(q.playerId, q.holeNumber))
          );
          for (const [k, v] of Object.entries(local)) {
            if (queued.has(k)) merged[k] = v;
          }
          saveLocalScores(slug, code, merged);
          return merged;
        });
        // Resume at the first hole without a complete score.
        const holes = data.holes as TeamInfo["holes"];
        const players = data.players as TeamInfo["players"];
        const isTeamFormat = data.event.format === "scramble";
        const firstIncomplete = holes.find((h) => {
          if (isTeamFormat) return !(scoreKey(null, h.holeNumber) in loadLocalScores(slug, code));
          return players.some((p) => !(scoreKey(p.id, h.holeNumber) in loadLocalScores(slug, code)));
        });
        if (firstIncomplete) setHole(firstIncomplete.holeNumber);
        doFlush();
      })
      .catch((e) => {
        // Offline on load: fall back to cached roster if we have one.
        const cached = localStorage.getItem(`golf-team-${slug}-${code}`);
        if (cached) {
          setInfo(JSON.parse(cached));
        } else {
          setLoadError(e.message);
        }
      });
  }, [slug, code, doFlush]);

  useEffect(() => {
    if (info) localStorage.setItem(`golf-team-${slug}-${code}`, JSON.stringify(info));
  }, [info, slug, code]);

  useEffect(() => {
    const onOnline = () => doFlush();
    const onVisible = () => document.visibilityState === "visible" && doFlush();
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);
    flushTimer.current = setInterval(doFlush, 20000);
    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      if (flushTimer.current) clearInterval(flushTimer.current);
    };
  }, [doFlush]);

  if (loadError) {
    return (
      <main className="mx-auto max-w-md p-8 text-center">
        <h1 className="font-display text-2xl font-semibold text-clay">Can&apos;t open scorecard</h1>
        <p className="mt-2 text-putty">{loadError}</p>
        <p className="mt-2 text-sm text-putty/80">Check that your team link is correct.</p>
      </main>
    );
  }
  if (!info) {
    return (
      <main className="p-10 text-center text-sm uppercase tracking-[0.2em] text-putty">
        Loading scorecard…
      </main>
    );
  }

  const isTeamFormat = info.event.format === "scramble";
  const currentHole = info.holes.find((h) => h.holeNumber === hole) ?? info.holes[0];
  const finalized = info.event.status === "final";

  function setStrokes(playerId: string | null, value: number | null) {
    const key = scoreKey(playerId, currentHole.holeNumber);
    setScores((prev) => {
      const next = { ...prev };
      if (value === null) delete next[key];
      else next[key] = value;
      saveLocalScores(slug, code, next);
      return next;
    });
    enqueue(slug, code, {
      holeNumber: currentHole.holeNumber,
      playerId,
      strokes: value,
    });
    setSync("pending");
    doFlush();
  }

  const rows: { playerId: string | null; label: string }[] = isTeamFormat
    ? [{ playerId: null, label: info.team.name }]
    : info.players.map((p) => ({ playerId: p.id, label: p.name }));

  const holeIndex = info.holes.findIndex((h) => h.holeNumber === hole);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      {/* Team masthead */}
      <header className="board-texture flex items-center justify-between bg-pine px-4 py-3.5 text-cream">
        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-cream/55">
            {info.event.name}
          </div>
          <div className="font-display text-lg font-semibold leading-tight">{info.team.name}</div>
        </div>
        <SyncPill state={sync} />
      </header>

      <div className="flex flex-1 flex-col px-4 py-4">
        {finalized && (
          <div className="mb-3 rounded-sm border border-brass/40 bg-brass/10 p-3 text-center text-[13px] font-semibold uppercase tracking-[0.12em] text-ink">
            Event finalized — scores are locked
          </div>
        )}

        {/* Hole header */}
        <div className="mb-4 flex items-center justify-between rounded-md border border-ink/10 bg-paper px-2 py-2">
          <button
            className="flex h-14 w-14 items-center justify-center rounded-sm border border-ink/15 text-xl text-ink transition-colors active:bg-linen disabled:opacity-25"
            disabled={holeIndex <= 0}
            aria-label="Previous hole"
            onClick={() => setHole(info.holes[holeIndex - 1].holeNumber)}
          >
            ←
          </button>
          <div className="text-center">
            <div className="text-[10px] font-semibold uppercase tracking-[0.28em] text-putty">Hole</div>
            <div className="font-display text-4xl font-semibold leading-none text-pine">
              {currentHole.holeNumber}
            </div>
            <div className="mt-1 text-[12px] uppercase tracking-[0.14em] text-putty">
              Par {currentHole.par}
              {currentHole.strokeIndex ? ` · SI ${currentHole.strokeIndex}` : ""}
            </div>
          </div>
          <button
            className="flex h-14 w-14 items-center justify-center rounded-sm border border-ink/15 text-xl text-ink transition-colors active:bg-linen disabled:opacity-25"
            disabled={holeIndex >= info.holes.length - 1}
            aria-label="Next hole"
            onClick={() => setHole(info.holes[holeIndex + 1].holeNumber)}
          >
            →
          </button>
        </div>

        {/* Score rows */}
        <div className="flex-1 space-y-3">
          {rows.map((row) => {
            const key = scoreKey(row.playerId, currentHole.holeNumber);
            const value = scores[key];
            return (
              <div key={key} className="rounded-md border border-ink/10 bg-paper p-3">
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-semibold text-ink">{row.label}</span>
                  {value !== undefined && (
                    <span className="text-[12px] font-semibold uppercase tracking-[0.14em] text-brass">
                      {describeScore(value, currentHole.par)}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    className="h-16 w-16 shrink-0 rounded-sm border border-ink/15 bg-cream text-3xl font-semibold text-pine transition-colors active:bg-linen disabled:opacity-25"
                    disabled={finalized || value === undefined || value <= 1}
                    aria-label={`Decrease ${row.label} score`}
                    onClick={() => setStrokes(row.playerId, (value ?? currentHole.par) - 1)}
                  >
                    −
                  </button>
                  <div className="flex-1 text-center">
                    {value === undefined ? (
                      <button
                        className="w-full rounded-sm border border-dashed border-brass/60 py-3.5 text-[13px] font-semibold uppercase tracking-[0.14em] text-brass transition-colors active:bg-brass/10"
                        disabled={finalized}
                        onClick={() => setStrokes(row.playerId, currentHole.par)}
                      >
                        Tap for par {currentHole.par}
                      </button>
                    ) : (
                      <span className="font-display text-6xl font-semibold tabular-nums text-pine">
                        {value}
                      </span>
                    )}
                  </div>
                  <button
                    className="h-16 w-16 shrink-0 rounded-sm border border-ink/15 bg-cream text-3xl font-semibold text-pine transition-colors active:bg-linen disabled:opacity-25"
                    disabled={finalized || (value ?? 0) >= 20}
                    aria-label={`Increase ${row.label} score`}
                    onClick={() => setStrokes(row.playerId, (value ?? currentHole.par - 1) + 1)}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Hole navigator */}
        <nav className="mt-5 grid grid-cols-9 gap-1">
          {info.holes.map((h) => {
            const complete = rows.every(
              (r) => scores[scoreKey(r.playerId, h.holeNumber)] !== undefined
            );
            return (
              <button
                key={h.holeNumber}
                onClick={() => setHole(h.holeNumber)}
                className={`rounded-sm py-2 text-[13px] font-semibold tabular-nums transition-colors ${
                  h.holeNumber === hole
                    ? "bg-pine text-cream"
                    : complete
                      ? "bg-linen text-ink"
                      : "border border-ink/10 bg-paper text-putty"
                }`}
              >
                {h.holeNumber}
              </button>
            );
          })}
        </nav>

        <a
          href={`/e/${slug}`}
          className="mt-5 block rounded-sm border border-ink/25 py-3.5 text-center text-[13px] font-semibold uppercase tracking-[0.16em] text-ink transition-colors hover:bg-linen/60"
        >
          View leaderboard
        </a>
      </div>
    </main>
  );
}

function SyncPill({ state }: { state: SyncState }) {
  const styles = {
    saved: "border-cream/30 text-cream/90",
    saving: "border-brass-light/60 text-brass-light",
    pending: "border-[#ff8a70]/60 text-[#ff8a70]",
  }[state];
  const label = { saved: "Saved", saving: "Saving…", pending: "Offline · will retry" }[state];
  return (
    <span
      className={`rounded-sm border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles}`}
    >
      {label}
    </span>
  );
}

function describeScore(strokes: number, par: number): string {
  const diff = strokes - par;
  if (strokes === 1) return "Ace";
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double";
  return `+${diff}`;
}
