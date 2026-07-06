"use client";

import { use, useCallback, useEffect, useState } from "react";
import { Button, Card, Input, PageShell } from "@/components/ui";
import { EventNav } from "@/components/EventNav";
import { rememberEvent } from "@/lib/client/recentEvents";

interface EventConfig {
  entryFeePerTeam?: number;
  payout?: { type: "percentage" | "fixed"; places: number[] };
  holesToPlay?: number;
  stableford?: { points: Record<string, number> };
  bestBall?: { countBestN: number; handicapAllowancePct: number };
  rulesNotes?: string;
}

interface EventInfo {
  event: {
    slug: string;
    name: string;
    format: string;
    status: "setup" | "live" | "final";
    config: EventConfig;
  };
  holes: { holeNumber: number; par: number; strokeIndex: number | null }[];
  contests: { id: string; name: string; prizeAmount: number; winnerName: string | null }[];
}

interface AdminTeam {
  id: string;
  name: string;
  joinCode: string;
  lockedHoles: number[];
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
      rememberEvent({ slug, name: infoJson.event.name });
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

  async function unlockHole(teamId: string, holeNumber: number) {
    const res = await fetch(`/api/events/${slug}/scores`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-org-pin": pin! },
      body: JSON.stringify({ teamId, entries: [], unlockHoles: [holeNumber] }),
    });
    if (res.ok) {
      setTeams((prev) =>
        prev.map((t) =>
          t.id === teamId
            ? { ...t, lockedHoles: t.lockedHoles.filter((h) => h !== holeNumber) }
            : t
        )
      );
    }
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
      <EventNav slug={slug} active="admin" />
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

      <EventSettings
        key={`${info.event.name}|${info.event.format}|${JSON.stringify(info.event.config)}`}
        slug={slug}
        pin={pin}
        info={info}
        onSaved={(msg) => {
          setNotice(msg);
          load(pin!).catch(() => {});
        }}
      />

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
                  {team.lockedHoles.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                        Locked holes — tap to unlock for the team
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {team.lockedHoles.map((h) => (
                          <button
                            key={h}
                            onClick={() => {
                              if (confirm(`Unlock hole ${h} so ${team.name} can edit it again?`)) {
                                unlockHole(team.id, h);
                              }
                            }}
                            className="rounded-sm bg-moss px-2.5 py-1.5 text-[12px] font-bold text-cream transition-colors hover:bg-clay"
                          >
                            {h} ✕
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
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

const FORMAT_OPTIONS = [
  { id: "scramble", label: "Scramble" },
  { id: "stroke", label: "Stroke play" },
  { id: "best_ball", label: "Best ball (net)" },
  { id: "stableford", label: "Stableford" },
] as const;

/** Editable event rules, payouts, and course — everything set in the wizard can be changed here. */
function EventSettings({
  slug,
  pin,
  info,
  onSaved,
}: {
  slug: string;
  pin: string;
  info: EventInfo;
  onSaved: (msg: string) => void;
}) {
  const cfg = info.event.config;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(info.event.name);
  const [format, setFormat] = useState(info.event.format);
  const [entryFee, setEntryFee] = useState(String(cfg.entryFeePerTeam ?? 0));
  const [payoutType, setPayoutType] = useState<"percentage" | "fixed">(
    cfg.payout?.type ?? "percentage"
  );
  const [places, setPlaces] = useState<string[]>(
    (cfg.payout?.places ?? [50, 30, 20]).map(String)
  );
  const [countBestN, setCountBestN] = useState(cfg.bestBall?.countBestN ?? 2);
  const [allowancePct, setAllowancePct] = useState(
    String(cfg.bestBall?.handicapAllowancePct ?? 100)
  );
  const [points, setPoints] = useState<Record<string, string>>(() => {
    const table = cfg.stableford?.points ?? { "-3": 5, "-2": 4, "-1": 3, "0": 2, "1": 1, "2": 0 };
    const fixed: Record<string, string> = {};
    for (const k of ["-3", "-2", "-1", "0", "1", "2"]) {
      fixed[k] = String(table[k] ?? 0);
    }
    return fixed;
  });
  const [rulesNotes, setRulesNotes] = useState(cfg.rulesNotes ?? "");
  const [pars, setPars] = useState<number[]>(info.holes.map((h) => h.par));
  const [sis, setSis] = useState<string[]>(
    info.holes.map((h) => (h.strokeIndex ? String(h.strokeIndex) : ""))
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const needsSi = format === "best_ball" || format === "stableford";

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const config = {
        entryFeePerTeam: parseFloat(entryFee) || 0,
        payout: {
          type: payoutType,
          places: places.map((p) => parseFloat(p) || 0).filter((_, i) => places[i] !== ""),
        },
        holesToPlay: cfg.holesToPlay ?? info.holes.length,
        ...(format === "best_ball"
          ? { bestBall: { countBestN, handicapAllowancePct: parseFloat(allowancePct) || 100 } }
          : {}),
        ...(format === "stableford"
          ? {
              stableford: {
                points: Object.fromEntries(
                  Object.entries(points).map(([k, v]) => [k, parseInt(v) || 0])
                ),
              },
            }
          : {}),
        ...(rulesNotes.trim() ? { rulesNotes: rulesNotes.trim() } : {}),
      };

      const evRes = await fetch(`/api/events/${slug}`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-org-pin": pin },
        body: JSON.stringify({ name, format, config }),
      });
      if (!evRes.ok) {
        const j = await evRes.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not save settings");
      }

      const holesRes = await fetch(`/api/events/${slug}/holes`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-org-pin": pin },
        body: JSON.stringify({
          holes: info.holes.map((h, i) => ({
            holeNumber: h.holeNumber,
            par: pars[i],
            strokeIndex: parseInt(sis[i]) || null,
          })),
        }),
      });
      if (!holesRes.ok) {
        const j = await holesRes.json().catch(() => ({}));
        throw new Error(j.error ?? "Could not save the course");
      }

      onSaved("Event settings saved — the leaderboard reflects them immediately.");
      setOpen(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-4 !p-3">
      <button className="flex w-full items-center justify-between px-1" onClick={() => setOpen(!open)}>
        <span className="font-display text-lg font-semibold text-pine">Event settings</span>
        <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-putty">
          {open ? "Close" : "Rules · payouts · course"}
        </span>
      </button>

      {open && (
        <div className="mt-4 space-y-5 border-t border-ink/10 px-1 pt-4">
          <Input label="Event name" value={name} onChange={(e) => setName(e.target.value)} />

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
              Format
            </span>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <Button
                  key={f.id}
                  variant={format === f.id ? "primary" : "secondary"}
                  className="!py-2.5 !text-[11px]"
                  onClick={() => setFormat(f.id)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            {format !== info.event.format && (
              <p className="mt-1.5 text-[12px] text-clay">
                Careful: changing the format after scores are entered can leave holes incomplete
                (scramble records one team score; the other formats need every player).
              </p>
            )}
          </div>

          {format === "stableford" && (
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                Stableford points (net vs par)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {([["-3", "Albatross"], ["-2", "Eagle"], ["-1", "Birdie"], ["0", "Par"], ["1", "Bogey"], ["2", "Double"]] as const).map(([diff, label]) => (
                  <label key={diff} className="block text-center">
                    <span className="block text-[11px] text-putty">{label}</span>
                    <input
                      aria-label={`Points for ${label}`}
                      inputMode="numeric"
                      className="w-full rounded-sm border border-ink/20 bg-paper py-1.5 text-center font-semibold"
                      value={points[diff]}
                      onChange={(e) => setPoints({ ...points, [diff]: e.target.value })}
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {format === "best_ball" && (
            <div className="space-y-3">
              <div>
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                  Best N net scores count per hole
                </span>
                <div className="flex gap-2">
                  {[1, 2, 3, 4].map((n) => (
                    <Button
                      key={n}
                      variant={countBestN === n ? "primary" : "secondary"}
                      className="flex-1 !py-2"
                      onClick={() => setCountBestN(n)}
                    >
                      {n}
                    </Button>
                  ))}
                </div>
              </div>
              <Input
                label="Handicap allowance (%)"
                inputMode="numeric"
                value={allowancePct}
                onChange={(e) => setAllowancePct(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Input
              label="Entry fee per team ($)"
              inputMode="decimal"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant={payoutType === "percentage" ? "primary" : "secondary"}
                className="flex-1 !py-2 !text-[11px]"
                onClick={() => setPayoutType("percentage")}
              >
                % of purse
              </Button>
              <Button
                variant={payoutType === "fixed" ? "primary" : "secondary"}
                className="flex-1 !py-2 !text-[11px]"
                onClick={() => setPayoutType("fixed")}
              >
                Fixed $
              </Button>
            </div>
            {places.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 font-display text-base font-semibold text-pine">
                  {["1st", "2nd", "3rd"][i] ?? `${i + 1}th`}
                </span>
                <Input
                  inputMode="decimal"
                  aria-label={`Payout for place ${i + 1}`}
                  value={p}
                  onChange={(e) => setPlaces(places.map((v, j) => (j === i ? e.target.value : v)))}
                />
                <Button
                  variant="ghost"
                  className="!px-2"
                  aria-label={`Remove place ${i + 1}`}
                  onClick={() => setPlaces(places.filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              variant="secondary"
              className="w-full !py-2 !text-[11px]"
              onClick={() => setPlaces([...places, ""])}
            >
              + Add place
            </Button>
          </div>

          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
              Course — par{needsSi ? " and stroke index" : ""}
            </span>
            <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
              {info.holes.map((h, i) => (
                <div key={h.holeNumber} className="rounded-sm border border-ink/10 bg-cream/60 p-2 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-putty">
                    Hole {h.holeNumber}
                  </div>
                  <select
                    aria-label={`Par for hole ${h.holeNumber}`}
                    className="mt-0.5 w-full rounded border-0 bg-transparent text-center font-display text-xl font-semibold text-pine"
                    value={pars[i]}
                    onChange={(e) =>
                      setPars(pars.map((p, j) => (j === i ? parseInt(e.target.value) : p)))
                    }
                  >
                    {[3, 4, 5, 6].map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {needsSi && (
                    <input
                      aria-label={`Stroke index for hole ${h.holeNumber}`}
                      className="mt-1 w-full rounded-sm border border-ink/15 bg-paper text-center text-sm"
                      inputMode="numeric"
                      value={sis[i]}
                      onChange={(e) =>
                        setSis(sis.map((s, j) => (j === i ? e.target.value : s)))
                      }
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
              Tournament rules / notes (shown on the leaderboard)
            </span>
            <textarea
              rows={4}
              className="w-full rounded-sm border border-ink/20 bg-paper px-3 py-3 text-base text-ink placeholder:text-putty/70 focus:border-brass focus:outline-none"
              placeholder="e.g. Lift, clean and place. Max score triple bogey."
              value={rulesNotes}
              onChange={(e) => setRulesNotes(e.target.value)}
            />
          </label>

          {err && (
            <p className="rounded-sm border border-clay/40 bg-clay/10 p-3 text-sm text-clay">{err}</p>
          )}
          <Button className="w-full" disabled={saving} onClick={save}>
            {saving ? "Saving…" : "Save settings"}
          </Button>
        </div>
      )}
    </Card>
  );
}
