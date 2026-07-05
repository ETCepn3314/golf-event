"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { Button, Card } from "@/components/ui";
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
      <main className="mx-auto max-w-md p-6 text-center">
        <h1 className="text-xl font-bold text-red-700">Can&apos;t open scorecard</h1>
        <p className="mt-2 text-slate-600">{loadError}</p>
        <p className="mt-2 text-sm text-slate-500">Check that your team link is correct.</p>
      </main>
    );
  }
  if (!info) {
    return <main className="p-8 text-center text-slate-500">Loading scorecard…</main>;
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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-4">
      <header className="mb-3 flex items-center justify-between">
        <div>
          <div className="text-sm text-slate-500">{info.event.name}</div>
          <div className="text-lg font-bold text-emerald-900">{info.team.name}</div>
        </div>
        <SyncPill state={sync} />
      </header>

      {finalized && (
        <div className="mb-3 rounded-xl bg-amber-100 p-3 text-center text-sm font-medium text-amber-900">
          Event is finalized — scores are locked.
        </div>
      )}

      <Card className="mb-3 flex items-center justify-between !p-3">
        <Button
          variant="secondary"
          className="!px-5 !py-4 text-xl"
          disabled={holeIndex <= 0}
          aria-label="Previous hole"
          onClick={() => setHole(info.holes[holeIndex - 1].holeNumber)}
        >
          ←
        </Button>
        <div className="text-center">
          <div className="text-3xl font-bold text-emerald-900">Hole {currentHole.holeNumber}</div>
          <div className="text-sm text-slate-500">
            Par {currentHole.par}
            {currentHole.strokeIndex ? ` · SI ${currentHole.strokeIndex}` : ""}
          </div>
        </div>
        <Button
          variant="secondary"
          className="!px-5 !py-4 text-xl"
          disabled={holeIndex >= info.holes.length - 1}
          aria-label="Next hole"
          onClick={() => setHole(info.holes[holeIndex + 1].holeNumber)}
        >
          →
        </Button>
      </Card>

      <div className="flex-1 space-y-3">
        {rows.map((row) => {
          const key = scoreKey(row.playerId, currentHole.holeNumber);
          const value = scores[key];
          return (
            <Card key={key} className="!p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-semibold">{row.label}</span>
                {value !== undefined && (
                  <span className="text-sm text-slate-500">{describeScore(value, currentHole.par)}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  className="h-16 w-16 shrink-0 rounded-2xl bg-emerald-100 text-3xl font-bold text-emerald-900 active:bg-emerald-200 disabled:opacity-30"
                  disabled={finalized || value === undefined || value <= 1}
                  aria-label={`Decrease ${row.label} score`}
                  onClick={() => setStrokes(row.playerId, (value ?? currentHole.par) - 1)}
                >
                  −
                </button>
                <div className="flex-1 text-center">
                  {value === undefined ? (
                    <button
                      className="w-full rounded-2xl border-2 border-dashed border-emerald-300 py-3 text-lg font-medium text-emerald-700 active:bg-emerald-50"
                      disabled={finalized}
                      onClick={() => setStrokes(row.playerId, currentHole.par)}
                    >
                      Tap: par {currentHole.par}
                    </button>
                  ) : (
                    <span className="text-5xl font-bold tabular-nums text-slate-900">{value}</span>
                  )}
                </div>
                <button
                  className="h-16 w-16 shrink-0 rounded-2xl bg-emerald-100 text-3xl font-bold text-emerald-900 active:bg-emerald-200 disabled:opacity-30"
                  disabled={finalized || (value ?? 0) >= 20}
                  aria-label={`Increase ${row.label} score`}
                  onClick={() => setStrokes(row.playerId, (value ?? currentHole.par - 1) + 1)}
                >
                  +
                </button>
              </div>
            </Card>
          );
        })}
      </div>

      <nav className="mt-4 grid grid-cols-9 gap-1">
        {info.holes.map((h) => {
          const complete = rows.every(
            (r) => scores[scoreKey(r.playerId, h.holeNumber)] !== undefined
          );
          return (
            <button
              key={h.holeNumber}
              onClick={() => setHole(h.holeNumber)}
              className={`rounded-lg py-2 text-sm font-semibold ${
                h.holeNumber === hole
                  ? "bg-emerald-700 text-white"
                  : complete
                    ? "bg-emerald-200 text-emerald-900"
                    : "bg-white text-slate-400 border border-emerald-100"
              }`}
            >
              {h.holeNumber}
            </button>
          );
        })}
      </nav>

      <a href={`/e/${slug}`} className="mt-4">
        <Button variant="secondary" className="w-full">View leaderboard</Button>
      </a>
    </main>
  );
}

function SyncPill({ state }: { state: SyncState }) {
  const styles = {
    saved: "bg-emerald-100 text-emerald-800",
    saving: "bg-sky-100 text-sky-800",
    pending: "bg-amber-100 text-amber-900",
  }[state];
  const label = { saved: "Saved ✓", saving: "Saving…", pending: "Offline — will retry" }[state];
  return <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles}`}>{label}</span>;
}

function describeScore(strokes: number, par: number): string {
  const diff = strokes - par;
  if (strokes === 1) return "Ace!";
  if (diff <= -3) return "Albatross";
  if (diff === -2) return "Eagle";
  if (diff === -1) return "Birdie";
  if (diff === 0) return "Par";
  if (diff === 1) return "Bogey";
  if (diff === 2) return "Double bogey";
  return `+${diff}`;
}
