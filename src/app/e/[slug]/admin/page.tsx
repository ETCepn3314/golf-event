"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Button, Card, Input, PageShell } from "@/components/ui";

interface EventInfo {
  event: {
    slug: string;
    name: string;
    format: string;
    status: "setup" | "live" | "final";
    config: { entryFeePerTeam?: number };
  };
  holes: { holeNumber: number; par: number; strokeIndex: number | null }[];
  contests: { id: string; name: string; prizeAmount: number; winnerName: string | null }[];
}

interface AdminTeam {
  id: string;
  name: string;
  joinCode: string;
  players: { id: string; name: string; handicap: number }[];
}

export default function AdminPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const [pin, setPin] = useState<string | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [info, setInfo] = useState<EventInfo | null>(null);
  const [teams, setTeams] = useState<AdminTeam[]>([]);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [editTeam, setEditTeam] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(
    async (candidatePin: string) => {
      const [infoRes, teamsRes, lbRes] = await Promise.all([
        fetch(`/api/events/${slug}`, { headers: { "x-org-pin": candidatePin } }),
        fetch(`/api/events/${slug}/teams`, { headers: { "x-org-pin": candidatePin } }),
        fetch(`/api/events/${slug}/leaderboard`),
      ]);
      if (teamsRes.status === 403) {
        throw new Error("Wrong PIN for this event.");
      }
      if (!infoRes.ok || !teamsRes.ok) throw new Error("Could not load event.");
      const infoJson = await infoRes.json();
      const teamsJson = await teamsRes.json();
      setInfo(infoJson);
      setTeams(teamsJson.teams);
      if (lbRes.ok) {
        const lb = await lbRes.json();
        const map: Record<string, number> = {};
        for (const row of lb.leaderboard) {
          for (const h of row.holeDetails) {
            if (h.playerStrokes.length > 0) {
              for (const ps of h.playerStrokes) {
                if (ps.strokes !== null) map[`${ps.playerId}:${h.holeNumber}`] = ps.strokes;
              }
            } else if (h.complete) {
              map[`${row.teamId}:team:${h.holeNumber}`] = h.value;
            }
          }
        }
        setScores(map);
      }
    },
    [slug]
  );

  useEffect(() => {
    const saved = localStorage.getItem(`org-pin-${slug}`);
    if (!saved) return;
    let cancelled = false;
    (async () => {
      try {
        await load(saved);
        if (!cancelled) setPin(saved);
      } catch {
        localStorage.removeItem(`org-pin-${slug}`);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug, load]);

  async function submitPin() {
    setAuthError(null);
    try {
      await load(pinInput);
      localStorage.setItem(`org-pin-${slug}`, pinInput);
      setPin(pinInput);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!pin || !info) {
    return (
      <PageShell title="Organizer dashboard" subtitle="Enter the 6-digit PIN from when the event was created.">
        <Card className="space-y-3">
          <Input
            label="Organizer PIN"
            inputMode="numeric"
            maxLength={6}
            value={pinInput}
            className="text-center font-mono text-2xl tracking-widest"
            onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))}
          />
          {authError && <p className="text-sm text-clay">{authError}</p>}
          <Button className="w-full" disabled={pinInput.length !== 6} onClick={submitPin}>
            Unlock
          </Button>
        </Card>
      </PageShell>
    );
  }

  const isFinal = info.event.status === "final";
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  async function setStatus(status: "live" | "final") {
    setBusy(true);
    setNotice(null);
    const res = await fetch(`/api/events/${slug}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-org-pin": pin! },
      body: JSON.stringify({ status }),
    });
    setBusy(false);
    if (res.ok) {
      setInfo({ ...info!, event: { ...info!.event, status } });
      setNotice(status === "final" ? "Event finalized — scoring is locked and payouts are official." : "Event reopened for scoring.");
    } else {
      setNotice("Update failed — try again.");
    }
  }

  async function saveScore(teamId: string, playerId: string | null, holeNumber: number, raw: string) {
    const strokes = raw === "" ? null : parseInt(raw);
    if (strokes !== null && (isNaN(strokes) || strokes < 1 || strokes > 20)) return;
    const key = playerId ? `${playerId}:${holeNumber}` : `${teamId}:team:${holeNumber}`;
    setScores((prev) => {
      const next = { ...prev };
      if (strokes === null) delete next[key];
      else next[key] = strokes;
      return next;
    });
    await fetch(`/api/events/${slug}/scores`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-org-pin": pin! },
      body: JSON.stringify({ teamId, entries: [{ holeNumber, playerId, strokes }] }),
    });
  }

  async function saveContestWinner(contestId: string, winnerName: string) {
    await fetch(`/api/events/${slug}/contests/${contestId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-org-pin": pin! },
      body: JSON.stringify({ winnerName: winnerName.trim() === "" ? null : winnerName }),
    });
  }

  const isScramble = info.event.format === "scramble";

  return (
    <PageShell title="Organizer dashboard" subtitle={info.event.name}>
      {notice && (
        <p className="mb-4 rounded-sm border border-brass/40 bg-brass/10 p-3 text-sm text-ink">{notice}</p>
      )}

      <Card className="mb-4 flex items-center justify-between">
        <div>
          <div className="font-display text-lg font-semibold text-pine">
            Status — {isFinal ? "Final" : "Live"}
          </div>
          <div className="text-[13px] text-putty">
            {isFinal ? "Scores locked; payouts official." : "Teams can enter scores; payouts are projected."}
          </div>
        </div>
        {isFinal ? (
          <Button variant="secondary" disabled={busy} onClick={() => setStatus("live")}>
            Reopen
          </Button>
        ) : (
          <Button
            disabled={busy}
            onClick={() => {
              if (confirm("Finalize the event? Team scoring will be locked and payouts become official.")) {
                setStatus("final");
              }
            }}
          >
            Finalize
          </Button>
        )}
      </Card>

      {info.contests.length > 0 && (
        <Card className="mb-4 space-y-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">Contest winners</h2>
          {info.contests.map((c) => (
            <div key={c.id} className="flex items-center gap-2">
              <div className="flex-1">
                <div className="text-sm font-semibold">{c.name} (${c.prizeAmount})</div>
                <Input
                  placeholder="Winner's name"
                  defaultValue={c.winnerName ?? ""}
                  onBlur={(e) => saveContestWinner(c.id, e.target.value)}
                />
              </div>
            </div>
          ))}
          <p className="text-xs text-putty">Winner saves when you tap away from the box.</p>
        </Card>
      )}

      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
        Teams — tap to review or correct scores
      </h2>
      <div className="space-y-2">
        {teams.map((team) => {
          const url = `${origin}/e/${slug}/t/${team.joinCode}`;
          const isOpen = editTeam === team.id;
          return (
            <Card key={team.id} className="!p-3">
              <button className="flex w-full items-center justify-between" onClick={() => setEditTeam(isOpen ? null : team.id)}>
                <span className="font-semibold text-ink">{team.name}</span>
                <span className="font-mono text-xs text-putty">code {team.joinCode}</span>
              </button>
              {isOpen && (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center justify-between gap-2 rounded-sm bg-cream p-2">
                    <span className="truncate font-mono text-xs text-ink/70">{url}</span>
                    <Button variant="secondary" className="!py-1.5 !px-3 !text-[10px]" onClick={() => navigator.clipboard.writeText(url)}>
                      Copy link
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="text-xs">
                      <thead>
                        <tr className="text-putty">
                          <th className="pr-2 text-left font-medium">Hole</th>
                          {info.holes.map((h) => (
                            <th key={h.holeNumber} className="px-0.5 text-center font-medium">{h.holeNumber}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(isScramble
                          ? [{ id: null as string | null, name: "Team" }]
                          : team.players.map((p) => ({ id: p.id as string | null, name: p.name }))
                        ).map((rowP) => (
                          <tr key={rowP.id ?? "team"}>
                            <td className="whitespace-nowrap pr-2 font-medium text-ink/70">{rowP.name}</td>
                            {info.holes.map((h) => {
                              const key = rowP.id ? `${rowP.id}:${h.holeNumber}` : `${team.id}:team:${h.holeNumber}`;
                              return (
                                <td key={h.holeNumber} className="p-0.5">
                                  <input
                                    aria-label={`${rowP.name} hole ${h.holeNumber}`}
                                    className="h-9 w-9 rounded-sm border border-ink/15 bg-paper text-center tabular-nums"
                                    inputMode="numeric"
                                    defaultValue={scores[key] ?? ""}
                                    onBlur={(e) => saveScore(team.id, rowP.id, h.holeNumber, e.target.value)}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-putty">Corrections save when you tap away from a box. Blank = no score.</p>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <a href={`/e/${slug}`} className="flex-1">
          <Button variant="secondary" className="w-full">Leaderboard</Button>
        </a>
        <a href={`/e/${slug}/money`} className="flex-1">
          <Button variant="secondary" className="w-full">Money</Button>
        </a>
      </div>
    </PageShell>
  );
}
