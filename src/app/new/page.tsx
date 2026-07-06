"use client";

import { useMemo, useState } from "react";
import { Button, Card, Input, PageShell } from "@/components/ui";
import { rememberEvent } from "@/lib/client/recentEvents";

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
  const [allowancePct, setAllowancePct] = useState("100");
  const [stablefordPoints, setStablefordPoints] = useState<Record<string, string>>({
    "-3": "5", "-2": "4", "-1": "3", "0": "2", "1": "1", "2": "0",
  });
  const [rulesNotes, setRulesNotes] = useState("");
  const [contests, setContests] = useState<{ name: string; prizeAmount: string }[]>([]);

  const [courseQuery, setCourseQuery] = useState("");
  const [courseResults, setCourseResults] = useState<
    { id: string; name: string; locality: string; lat: number; lon: number }[] | null
  >(null);
  const [courseBusy, setCourseBusy] = useState(false);
  const [courseMsg, setCourseMsg] = useState<string | null>(null);

  async function searchCourses() {
    setCourseBusy(true);
    setCourseMsg(null);
    setCourseResults(null);
    try {
      const res = await fetch(`/api/courses/search?q=${encodeURIComponent(courseQuery)}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Search failed");
      if (json.courses.length === 0) {
        setCourseMsg("No courses found by that name — check spelling, or enter the scorecard manually.");
      } else {
        setCourseResults(json.courses);
      }
    } catch (e) {
      setCourseMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCourseBusy(false);
    }
  }

  async function applyCourse(c: { id: string; name: string; lat: number; lon: number }) {
    setCourseBusy(true);
    setCourseMsg(null);
    try {
      const res = await fetch(
        `/api/courses/search?osm=${encodeURIComponent(c.id)}&lat=${c.lat}&lon=${c.lon}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Lookup failed");
      const found: { holeNumber: number; par: number; strokeIndex: number | null }[] = json.holes;
      if (found.length === 0) {
        setCourseMsg(`${c.name} is on the map, but its scorecard isn't — enter pars manually.`);
        return;
      }
      if (found.length >= 18) setHolesToPlay(18);
      else if (found.length >= 9 && found.length < 18) setHolesToPlay(9);
      setPars((prev) => {
        const next = [...prev];
        for (const h of found) next[h.holeNumber - 1] = h.par;
        return next;
      });
      const anySi = found.some((h) => h.strokeIndex);
      if (anySi) {
        setStrokeIndexes((prev) => {
          const next = [...prev];
          for (const h of found) {
            if (h.strokeIndex) next[h.holeNumber - 1] = String(h.strokeIndex);
          }
          return next;
        });
      }
      setCourseResults(null);
      setCourseMsg(
        `Filled ${found.length} holes from ${c.name}${anySi ? " (incl. stroke indexes)" : ""} — double-check against the printed scorecard.`
      );
    } catch (e) {
      setCourseMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setCourseBusy(false);
    }
  }

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
            ? {
                bestBall: {
                  countBestN,
                  handicapAllowancePct: parseFloat(allowancePct) || 100,
                },
              }
            : {}),
          ...(format === "stableford"
            ? {
                stableford: {
                  points: Object.fromEntries(
                    Object.entries(stablefordPoints).map(([k, v]) => [k, parseInt(v) || 0])
                  ),
                },
              }
            : {}),
          ...(rulesNotes.trim() ? { rulesNotes: rulesNotes.trim() } : {}),
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
      rememberEvent({ slug: json.slug, name });
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
    <PageShell
      title="Create an event"
      subtitle={`Step ${step + 1} of ${steps.length} — ${steps[step]}`}
      back={{ href: "/", label: "Home" }}
    >
      <div className="mb-5 flex gap-1">
        {steps.map((s, i) => (
          <div
            key={s}
            className={`h-[3px] flex-1 ${i <= step ? "bg-brass" : "bg-ink/10"}`}
          />
        ))}
      </div>

      {step === 0 && (
        <Card className="space-y-5">
          <Input label="Event name" value={name} placeholder="The Spring Invitational" onChange={(e) => setName(e.target.value)} />
          <Input label="Date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
              Format
            </span>
            <div className="space-y-2">
              {FORMATS.map((f) => (
                <div key={f.id}>
                  <button
                    onClick={() => setFormat(f.id)}
                    className={`w-full rounded-sm border p-3.5 text-left transition-colors ${
                      format === f.id
                        ? "border-pine bg-pine text-cream"
                        : "border-ink/15 bg-paper hover:border-ink/35"
                    }`}
                  >
                    <div className="font-display text-lg font-semibold">{f.label}</div>
                    <div className={`mt-0.5 text-[13px] ${format === f.id ? "text-cream/70" : "text-putty"}`}>
                      {f.blurb}
                    </div>
                  </button>

                  {format === f.id && f.id === "stableford" && (
                    <div className="mt-1 rounded-sm border border-brass/40 bg-brass/5 p-3">
                      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                        Points per hole (net score vs par)
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {([["-3", "Albatross"], ["-2", "Eagle"], ["-1", "Birdie"], ["0", "Par"], ["1", "Bogey"], ["2", "Double"]] as const).map(([diff, label]) => (
                          <label key={diff} className="block text-center">
                            <span className="block text-[11px] text-putty">{label}</span>
                            <input
                              aria-label={`Points for ${label}`}
                              inputMode="numeric"
                              className="w-full rounded-sm border border-ink/20 bg-paper py-1.5 text-center font-semibold"
                              value={stablefordPoints[diff]}
                              onChange={(e) =>
                                setStablefordPoints({ ...stablefordPoints, [diff]: e.target.value })
                              }
                            />
                          </label>
                        ))}
                      </div>
                      <p className="mt-2 text-[11px] text-putty">
                        Triple bogey or worse scores 0. Edit the numbers to match your outing&apos;s rules.
                      </p>
                    </div>
                  )}

                  {format === f.id && f.id === "best_ball" && (
                    <div className="mt-1 space-y-3 rounded-sm border border-brass/40 bg-brass/5 p-3">
                      <div>
                        <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                          Best N net scores count per hole
                        </div>
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
                      <p className="text-[11px] text-putty">
                        Many outings play 90% allowance; 100% uses full course handicaps.
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card className="space-y-5">
          <div>
            <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
              Find your course
            </span>
            <div className="flex gap-2">
              <Input
                placeholder="Course name, e.g. Torrey Pines"
                value={courseQuery}
                onChange={(e) => setCourseQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && courseQuery.trim().length >= 3) searchCourses();
                }}
              />
              <Button
                variant="secondary"
                disabled={courseBusy || courseQuery.trim().length < 3}
                onClick={searchCourses}
              >
                {courseBusy ? "…" : "Search"}
              </Button>
            </div>
            {courseResults && (
              <div className="mt-2 divide-y divide-ink/10 rounded-sm border border-ink/15 bg-paper">
                {courseResults.map((c) => (
                  <button
                    key={c.id}
                    className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-linen/50"
                    disabled={courseBusy}
                    onClick={() => applyCourse(c)}
                  >
                    <span className="font-semibold">{c.name}</span>
                    {c.locality && <span className="ml-2 text-[13px] text-putty">{c.locality}</span>}
                  </button>
                ))}
              </div>
            )}
            {courseMsg && <p className="mt-2 text-[13px] text-putty">{courseMsg}</p>}
            <p className="mt-1.5 text-[11px] text-putty/80">
              Scorecard data from OpenStreetMap — free, but not every course is mapped. You can always edit below.
            </p>
          </div>

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
                className="flex-1 !py-2 !text-[11px]"
                onClick={() => setPars(pars.map(() => p))}
              >
                All par {p}
              </Button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
            {holeNumbers.map((n) => (
              <div key={n} className="rounded-sm border border-ink/10 bg-cream/60 p-2 text-center">
                <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-putty">
                  Hole {n}
                </div>
                <select
                  aria-label={`Par for hole ${n}`}
                  className="mt-0.5 w-full rounded border-0 bg-transparent text-center font-display text-xl font-semibold text-pine"
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
                    className="mt-1 w-full rounded-sm border border-ink/15 bg-paper text-center text-sm"
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
            <p className="text-xs leading-relaxed text-putty">
              The small box is the hole&apos;s stroke index (1 = hardest), used to allocate handicap
              strokes. It&apos;s printed on the course scorecard.
            </p>
          )}
          <div className="border-t border-ink/10 pt-3 text-sm text-putty">
            Total par{" "}
            <span className="font-display text-lg font-semibold text-pine">
              {holeNumbers.reduce((a, n) => a + pars[n - 1], 0)}
            </span>
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
            <p className="text-xs text-putty">The narrow box is each player&apos;s course handicap.</p>
          )}
          <Button variant="secondary" className="w-full" onClick={() => setTeams([...teams, emptyTeam(teams.length + 1)])}>
            + Add team
          </Button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card className="space-y-5">
            <Input
              label="Entry fee per team ($)"
              inputMode="decimal"
              value={entryFee}
              onChange={(e) => setEntryFee(e.target.value)}
            />
            <div className="board-texture rounded-sm bg-pine p-4 text-center text-cream">
              <div className="text-[11px] uppercase tracking-[0.2em] text-cream/60">
                The purse — {teams.length} teams × ${parseFloat(entryFee) || 0}
              </div>
              <div className="mt-1 font-display text-4xl font-semibold text-brass-light">
                ${pot.toFixed(2)}
              </div>
            </div>
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                Payout type
              </span>
              <div className="flex gap-2">
                <Button
                  variant={payoutType === "percentage" ? "primary" : "secondary"}
                  className="flex-1"
                  onClick={() => setPayoutType("percentage")}
                >
                  % of purse
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
                  <span className="w-12 font-display text-base font-semibold text-pine">
                    {["1st", "2nd", "3rd"][i] ?? `${i + 1}th`}
                  </span>
                  <Input
                    inputMode="decimal"
                    aria-label={`Payout for place ${i + 1}`}
                    value={p}
                    onChange={(e) => setPlaces(places.map((v, j) => (j === i ? e.target.value : v)))}
                  />
                  <span className="w-16 text-right text-[13px] tabular-nums text-putty">
                    {payoutType === "percentage"
                      ? `$${((pot * (parseFloat(p) || 0)) / 100).toFixed(2)}`
                      : "$"}
                  </span>
                  <Button variant="ghost" className="!px-2" aria-label={`Remove place ${i + 1}`} onClick={() => setPlaces(places.filter((_, j) => j !== i))}>
                    ✕
                  </Button>
                </div>
              ))}
              <Button variant="secondary" className="w-full !py-2 !text-[11px]" onClick={() => setPlaces([...places, ""])}>
                + Add place
              </Button>
              {payoutType === "percentage" && (
                <p className="text-xs text-putty">
                  Percentages total {places.reduce((a, p) => a + (parseFloat(p) || 0), 0)}%.
                </p>
              )}
            </div>
          </Card>

          <Card className="space-y-2">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
              Side contests (optional)
            </span>
            {contests.map((c, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  placeholder="Closest to pin — No. 7"
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
            <Button variant="secondary" className="w-full !py-2 !text-[11px]" onClick={() => setContests([...contests, { name: "", prizeAmount: "25" }])}>
              + Add contest
            </Button>
          </Card>

          <Card>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
                Tournament rules / notes (optional)
              </span>
              <textarea
                rows={4}
                placeholder={"Shown to every player on the leaderboard.\ne.g. Lift, clean and place. Max score triple bogey. Gimmes inside the leather."}
                className="w-full rounded-sm border border-ink/20 bg-paper px-3 py-3 text-base text-ink placeholder:text-putty/70 focus:border-brass focus:outline-none"
                value={rulesNotes}
                onChange={(e) => setRulesNotes(e.target.value)}
              />
            </label>
          </Card>
        </div>
      )}

      {step === 4 && (
        <Card className="space-y-3 text-sm">
          <Row label="Event" value={`${name || "(unnamed)"} ${eventDate ? `— ${eventDate}` : ""}`} />
          <Row label="Format" value={FORMATS.find((f) => f.id === format)!.label} />
          <Row label="Course" value={`${holesToPlay} holes, par ${holeNumbers.reduce((a, n) => a + pars[n - 1], 0)}`} />
          <Row label="Teams" value={`${teams.length} teams`} />
          <Row label="Entry fee" value={`$${parseFloat(entryFee) || 0} per team → $${pot.toFixed(2)} purse`} />
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
          {rulesNotes.trim() && <Row label="Rules" value={rulesNotes.trim()} />}
          <p className="pt-1 text-[13px] leading-relaxed text-putty">
            After you create the event you&apos;ll get an organizer PIN and a private link for each
            team. Scoring opens immediately.
          </p>
        </Card>
      )}

      {error && (
        <p className="mt-4 rounded-sm border border-clay/40 bg-clay/10 p-3 text-sm text-clay">
          {error}
        </p>
      )}

      <div className="mt-6 flex gap-2">
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
    <div className="flex justify-between gap-4 border-b border-ink/8 pb-2.5 last:border-0 last:pb-0">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">{label}</span>
      <span className="text-right text-ink">{value}</span>
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
    <PageShell title="You're on the tee" subtitle={eventName}>
      <div className="board-texture mb-4 rounded-md bg-pine p-4 text-cream">
        <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brass-light">
          Organizer PIN — shown only once
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="font-display text-4xl font-semibold tracking-[0.2em] text-cream">
            {created.organizerPin}
          </span>
          <button
            onClick={() => copy("pin", created.organizerPin)}
            className="rounded-sm border border-cream/40 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-cream transition-colors hover:bg-cream/10"
          >
            {copied === "pin" ? "Copied" : "Copy"}
          </button>
        </div>
        <p className="mt-3 text-[13px] leading-relaxed text-cream/65">
          You&apos;ll need it to correct scores, record contest winners, and finalize results.
          It&apos;s also remembered on this device.
        </p>
      </div>

      <Card className="mb-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
          Public leaderboard — share with everyone
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <a className="truncate font-mono text-[13px] text-pine underline decoration-brass underline-offset-2" href={leaderboardUrl}>
            {leaderboardUrl}
          </a>
          <Button variant="secondary" className="!py-2 !px-3 !text-[11px]" onClick={() => copy("lb", leaderboardUrl)}>
            {copied === "lb" ? "Copied" : "Copy"}
          </Button>
        </div>
      </Card>

      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-putty">
        Team scoring links — text each one to its team
      </div>
      <div className="divide-y divide-ink/10 rounded-md border border-ink/10 bg-paper">
        {created.teams.map((t) => {
          const url = `${origin}/e/${created.slug}/t/${t.joinCode}`;
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="min-w-0">
                <div className="font-semibold text-ink">{t.name}</div>
                <div className="truncate font-mono text-xs text-putty">{url}</div>
              </div>
              <Button variant="secondary" className="!py-2 !px-3 !text-[11px]" onClick={() => copy(t.id, url)}>
                {copied === t.id ? "Copied" : "Copy"}
              </Button>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex gap-2">
        <a href={leaderboardUrl} className="flex-1">
          <Button className="w-full">Open leaderboard</Button>
        </a>
        <a href={`/e/${created.slug}/admin`} className="flex-1">
          <Button variant="secondary" className="w-full">Organizer desk</Button>
        </a>
      </div>
    </PageShell>
  );
}
