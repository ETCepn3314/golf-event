"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input, PageShell } from "@/components/ui";

type Format = "scramble" | "stroke" | "best_ball" | "stableford";

const FORMATS: { id: Format; label: string; blurb: string }[] = [
  { id: "scramble", label: "Scramble", blurb: "Team plays one ball — one score per team per hole." },
  { id: "stroke", label: "Stroke play", blurb: "Everyone plays their own ball — team total is the sum." },
  { id: "best_ball", label: "Best ball (net)", blurb: "Own ball with handicaps — best N net scores count per hole." },
  { id: "stableford", label: "Stableford", blurb: "Points per hole vs par (net) — highest points wins." },
];

interface TeamDraft {
  name: string;
  players: { name: string; handicap: string }[];
}

const emptyTeam = (n: number): TeamDraft => ({
  name: `Team ${n}`,
  players: Array.from({ length: 4 }, () => ({ name: "", handicap: "0" })),
});

interface CreatedEvent {
  slug: string;
  organizerPin: string;
  teams: { id: string; name: string; joinCode: string }[];
}

export default function NewEventPage() {
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedEvent | null>(null);

  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [format, setFormat] = useState<Format>("scramble");
  const [holesToPlay, setHolesToPlay] = useState<9 | 18>(18);
  const [pars, setPars] = useState<number[]>(Array(18).fill(4));
  const [strokeIndexes, setStrokeIndexes] = useState<string[]>(
    Array.from({ length: 18 }, (_, i) => String(i + 1))
  );
  const [teams, setTeams] = useState<TeamDraft[]>([emptyTeam(1), emptyTeam(2)]);
  const [entryFee, setEntryFee] = useState("100");
  const [payoutType, setPayoutType] = useState<"percentage" | "fixed">("percentage");
  const [places, setPlaces] = useState<string[]>(["50", "30", "20"]);
  const [countBestN, setCountBestN] = useState(2);
  const [contests, setContests] = useState<{ name: string; prizeAmount: string }[]>([]);

  const needsHandicaps = format === "best_ball" || format === "stableford";
  const needsStrokeIndex = needsHandicaps;
  const pot = (parseFloat(entryFee) || 0) * teams.length;
  const holeNumbers = useMemo(
    () => Array.from({ length: holesToPlay }, (_, i) => i + 1),
    [holesToPlay]
  );

  async function createEvent() {
    setSaving(true);
    setError(null);
    try {
      const body = {
        name,
        eventDate: eventDate || null,
        format,
        config: {
          entryFeePerTeam: parseFloat(entryFee) || 0,
          payout: {
            type: payoutType,
            places: places.map((p) => parseFloat(p) || 0).filter((_, i) => places[i] !== ""),
          },
          holesToPlay,
          ...(format === "best_ball"
            ? { bestBall: { countBestN, handicapAllowancePct: 100 } }
            : {}),
        },
        holes: holeNumbers.map((n) => ({
          holeNumber: n,
          par: pars[n - 1],
          strokeIndex: needsStrokeIndex ? parseInt(strokeIndexes[n - 1]) || null : null,
        })),
        teams: teams.map((t) => ({
          name: t.name,
          players: t.players
            .filter((p) => p.name.trim() !== "")
            .map((p) => ({ name: p.name, handicap: parseFloat(p.handicap) || 0 })),
        })),
        contests: contests
          .filter((c) => c.name.trim() !== "")
          .map((c) => ({ name: c.name, prizeAmount: parseFloat(c.prizeAmount) || 0 })),
      };
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({
        error: `Server error (${res.status}). If you're setting up, check that Supabase is configured in .env.local — see the README.`,
      }));
      if (!res.ok) throw new Error(json.error ?? "Failed to create event");
      localStorage.setItem(`org-pin-${json.slug}`, json.organizerPin);
      setCreated(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  if (created) return <ShareScreen created={created} eventName={name} />;

  const steps = ["Event", "Course", "Teams", "Money", "Review"];

  return (
    <PageShell title="Create an event" subtitle={`Step ${step + 1} of ${steps.length}: ${steps[step]}`}>
      <div className="mb-4 flex gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-emerald-600" : "bg-emerald-200"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <Card className="space-y-4">
          <Input label="Event name" value={name} placeholder="Spring Classic 2026" onChange={(e) => setName(e.target.value)} />
          <Input label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <div>
            <span className="mb-1 block text-sm font-medium text-slate-700">Format</span>
            <div className="space-y-2">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFormat(f.id)}
                  className={`w-full rounded-xl border p-3 text-left ${
                    format === f.id
                      ? "border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600"
                      : "border-emerald-200 bg-white"
                  }`}
                >
                  <div className="font-semibold">{f.label}</div>
                  <div className="text-sm text-slate-600">{f.blurb}</div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-4">
          <div className="flex gap-2">
            {([9, 18] as const).map((n) => (
              <Button
                key={n}
                variant={holesToPlay === n ? "primary" : "secondary"}
                className="flex-1"
                onClick={() => setHolesToPlay(n)}
              >
                {n} holes
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            {[3, 4, 5].map((p) => (
              <Button
                key={p}
                variant="secondary"
                className="flex-1 !py-2 text-sm"
                onClick={() => setPars(pars.map(() => p))}
              >
                All par {p}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {holeNumbers.map((n) => (
              <div key={n} className="rounded-lg border border-emerald-200 p-2 text-center">
                <div className="text-xs font-semibold text-slate-500">Hole {n}</div>
                <select
                  aria-label={`Par for hole ${n}`}
                  className="mt-1 w-full rounded border-0 bg-transparent text-center text-lg font-bold"
                  value={pars[n - 1]}
                  onChange={(e) =>
                    setPars(pars.map((p, i) => (i === n - 1 ? parseInt(e.target.value) : p)))
                  }
                >
                  {[3, 4, 5, 6].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                {needsStrokeIndex && (
                  <input
                    aria-label={`Stroke index for hole ${n}`}
                    className="mt-1 w-full rounded border border-emerald-100 text-center text-sm"
                    value={strokeIndexes[n - 1]}
                    inputMode="numeric"
                    onChange={(e) =>
                      setStrokeIndexes(
                        strokeIndexes.map((s, i) => (i === n - 1 ? e.target.value : s))
                      )
                    }
                  />
                )}
              </div>
            ))}
          </div>
          {needsStrokeIndex && (
            <p className="text-xs text-slate-500">
              The small box is the hole&apos;s stroke index (1 = hardest), used to allocate handicap strokes. It&apos;s printed on the course scorecard.
            </p>
          )}
          <div className="text-sm text-slate-600">
            Total par: <strong>{holeNumbers.reduce((a, n) => a + pars[n - 1], 0)}</strong>
          </div>
        </Card>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {teams.map((team, ti) => (
            <Card key={ti} className="space-y-3">
              <div className="flex items-center gap-2">
                <Input
                  value={team.name}
                  aria-label={`Team ${ti + 1} name`}
                  onChange={(e) =>
                    setTeams(teams.map((t, i) => (i === ti ? { ...t, name: e.target.value } : t)))
                  }
                />
                {teams.length > 1 && (
                  <Button
                    variant="ghost"
                    className="!px-3"
                    aria-label={`Remove team ${ti + 1}`}
                    onClick={() => setTeams(teams.filter((_, i) => i !== ti))}
                  >
                    ✕
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-2">
                {team.players.map((player, pi) => (
                  <div key={pi} className="flex gap-2">
                    <Input
                      placeholder={`Player ${pi + 1}`}
                      value={player.name}
                      onChange={(e) =>
                        setTeams(
                          teams.map((t, i) =>
                            i === ti
                              ? {
                                  ...t,
                                  players: t.players.map((p, j) =>
                                    j === pi ? { ...p, name: e.target.value } : p
                                  ),
                                }
                              : t
                          )
                        )
                      }
                    />
                    {needsHandicaps && (
                      <Input
                        className="!w-20 text-center"
                        aria-label={`Player ${pi + 1} handicap`}
                        inputMode="decimal"
                        value={player.handicap}
                        onChange={(e) =>
                          setTeams(
                            teams.map((t, i) =>
                              i === ti
                                ? {
                                    ...t,
                                    players: t.players.map((p, j) =>
                                      j === pi ? { ...p, handicap: e.target.value } : p
                                    ),
                                  }
                                : t
                            )
                          )
                        }
                      />
                    )}
                  </div>
                ))}
              </div>
            </Card>
          ))}
          {needsHandicaps && (
            <p className="text-xs text-slate-500">The narrow box is each player&apos;s course handicap.</p>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setTeams([...teams, emptyTeam(teams.length + 1)])}>
            + Add team
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="space-y-4">
            <Input
              label="Entry fee per team ($)"
              inputMode="decimal"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
            />
            <div className="rounded-xl bg-emerald-100 p-3 text-center">
              <div className="text-sm text-emerald-800">Pot: {teams.length} teams × ${parseFloat(entryFee) || 0}</div>
              <div className="text-2xl font-bold text-emerald-900">${pot.toFixed(2)}</div>
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-slate-700">Payout type</span>
              <div className="flex gap-2">
                <Button
                  variant={payoutType === "percentage" ? "primary" : "secondary"}
                  className="flex-1"
                  onClick={() => setPayoutType("percentage")}
                >
                  % of pot
                </Button>
                <Button
                  variant={payoutType === "fixed" ? "primary" : "secondary"}
                  className="flex-1"
                  onClick={() => setPayoutType("fixed")}
                >
                  Fixed $
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              {places.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-14 text-sm font-medium text-slate-600">
                    {["1st", "2nd", "3rd"][i] ?? `${i + 1}th`}
                  </span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Payout for place ${i + 1}`}
                    value={p}
                    onChange={(e) => setPlaces(places.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <span className="text-sm text-slate-500">
                    {payoutType === "percentage"
                      ? `$${((pot * (parseFloat(p) || 0)) / 100).toFixed(2)}`
                      : "$"}
                  </span>
                  <Button variant="ghost" className="!px-2" aria-label={`Remove place ${i + 1}`} onClick={() => setPlaces(places.filter((_, j) => j !== i))}>
                    ✕
                  </Button>
                </div>
              ))}
              <Button variant="secondary" className="w-full !py-2 text-sm" onClick={() => setPlaces([...places, ""])}>
                + Add place
              </Button>
              {payoutType === "percentage" && (
                <p className="text-xs text-slate-500">
                  Percentages total {places.reduce((a, p) => a + (parseFloat(p) || 0), 0)}%.
                </p>
              )}
            </div>
          </Card>

          <Card className="space-y-2">
            <span className="block text-sm font-medium text-slate-700">Side contests (optional)</span>
            {contests.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Closest to pin #7"
                  value={c.name}
                  onChange={(e) => setContests(contests.map((v, j) => (j === i ? { ...v, name: e.target.value } : v)))}
                />
                <Input
                  className="!w-24 text-center"
                  inputMode="decimal"
                  placeholder="$"
                  aria-label={`Prize for contest ${i + 1}`}
                  value={c.prizeAmount}
                  onChange={(e) => setContests(contests.map((v, j) => (j === i ? { ...v, prizeAmount: e.target.value } : v)))}
                />
                <Button variant="ghost" className="!px-2" aria-label={`Remove contest ${i + 1}`} onClick={() => setContests(contests.filter((_, j) => j !== i))}>
                  ✕
                </Button>
              </div>
            ))}
            <Button variant="secondary" className="w-full !py-2 text-sm" onClick={() => setContests([...contests, { name: "", prizeAmount: "25" }])}>
              + Add contest
            </Button>
          </Card>

          {format === "best_ball" && (
            <Card>
              <span className="mb-1 block text-sm font-medium text-slate-700">Best N net scores count per hole</span>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <Button
                    key={n}
                    variant={countBestN === n ? "primary" : "secondary"}
                    className="flex-1"
                    onClick={() => setCountBestN(n)}
                  >
                    {n}
                  </Button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {step === 4 && (
        <Card className="space-y-3 text-sm">
          <Row label="Event" value={`${name || "(unnamed)"} ${eventDate ? `— ${eventDate}` : ""}`} />
          <Row label="Format" value={FORMATS.find((f) => f.id === format)!.label} />
          <Row label="Course" value={`${holesToPlay} holes, par ${holeNumbers.reduce((a, n) => a + pars[n - 1], 0)}`} />
          <Row label="Teams" value={`${teams.length} teams`} />
          <Row label="Entry fee" value={`$${parseFloat(entryFee) || 0} per team → $${pot.toFixed(2)} pot`} />
          <Row
            label="Payouts"
            value={places
              .filter((p) => p !== "")
              .map((p, i) => `${["1st", "2nd", "3rd"][i] ?? `${i + 1}th`}: ${payoutType === "percentage" ? `${p}%` : `$${p}`}`)
              .join(", ") || "None"}
          />
          {contests.filter((c) => c.name.trim()).length > 0 && (
            <Row label="Contests" value={contests.filter((c) => c.name.trim()).map((c) => `${c.name} ($${c.prizeAmount})`).join(", ")} />
          )}
          <p className="text-slate-500">
            After you create the event you&apos;ll get an organizer PIN and a link for each team. Scores can be entered right away.
          </p>
        </Card>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <div className="mt-5 flex gap-2">
        {step > 0 && (
          <Button variant="secondary" className="flex-1" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        )}
        {step < 4 ? (
          <Button
            className="flex-1"
            disabled={step === 0 && name.trim() === ""}
            onClick={() => setStep(step + 1)}
          >
            Next
          </Button>
        ) : (
          <Button className="flex-1" disabled={saving} onClick={createEvent}>
            {saving ? "Creating…" : "Create event"}
          </Button>
        )}
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-emerald-50 pb-2 last:border-0">
      <span className="font-medium text-slate-500">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function ShareScreen({ created, eventName }: { created: CreatedEvent; eventName: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  function copy(key: string, text: string) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const leaderboardUrl = `${origin}/e/${created.slug}`;

  return (
    <PageShell title="Event created 🎉" subtitle={eventName}>
      <Card className="mb-4 border-amber-300 bg-amber-50">
        <div className="text-sm font-medium text-amber-900">Your organizer PIN — save it now, it is only shown here:</div>
        <div className="mt-1 flex items-center justify-between">
          <span className="font-mono text-3xl font-bold tracking-widest text-amber-900">{created.organizerPin}</span>
          <Button variant="secondary" onClick={() => copy("pin", created.organizerPin)}>
            {copied === "pin" ? "Copied ✓" : "Copy"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-amber-800">
          You need it to correct scores, enter contest winners, and finalize results. (It&apos;s also remembered on this device.)
        </p>
      </Card>

      <Card className="mb-4">
        <div className="text-sm font-medium text-slate-700">Public leaderboard — share with everyone:</div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <a className="truncate font-mono text-sm text-emerald-700 underline" href={leaderboardUrl}>
            {leaderboardUrl}
          </a>
          <Button variant="secondary" onClick={() => copy("lb", leaderboardUrl)}>
            {copied === "lb" ? "Copied ✓" : "Copy"}
          </Button>
        </div>
      </Card>

      <div className="mb-2 text-sm font-medium text-slate-700">Team scoring links — text each one to its team:</div>
      <div className="space-y-2">
        {created.teams.map((t) => {
          const url = `${origin}/e/${created.slug}/t/${t.joinCode}`;
          return (
            <Card key={t.id} className="flex items-center justify-between gap-2 !p-3">
              <div className="min-w-0">
                <div className="font-semibold">{t.name}</div>
                <div className="truncate font-mono text-xs text-slate-500">{url}</div>
              </div>
              <Button variant="secondary" onClick={() => copy(t.id, url)}>
                {copied === t.id ? "Copied ✓" : "Copy"}
              </Button>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <a href={leaderboardUrl} className="flex-1">
          <Button className="w-full">Open leaderboard</Button>
        </a>
        <a href={`/e/${created.slug}/admin`} className="flex-1">
          <Button variant="secondary" className="w-full">Organizer dashboard</Button>
        </a>
      </div>
    </PageShell>
  );
}
