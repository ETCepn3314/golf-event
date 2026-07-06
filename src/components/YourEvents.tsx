"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  forgetEvent,
  listRecentEvents,
  organizerPinFor,
  parseEventInput,
  type RecentEvent,
} from "@/lib/client/recentEvents";

/**
 * Landing-page section: every event this device has created, scored, or
 * watched, with quick links back in — plus a box to open any event by link.
 */
export function YourEvents() {
  const router = useRouter();
  const [events, setEvents] = useState<RecentEvent[] | null>(null);
  const [input, setInput] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    // localStorage is only readable after mount; renders nothing until then.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEvents(listRecentEvents());
  }, []);

  function openInput() {
    const path = parseEventInput(input);
    if (!path) {
      setInputError("That doesn't look like an event link or code — paste the full link your organizer sent.");
      return;
    }
    router.push(path);
  }

  if (events === null) return null;

  return (
    <section>
      <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
        Your events
      </div>

      {events.length === 0 ? (
        <p className="mt-3 text-sm text-putty">
          Events you create or score on this device will show up here.
        </p>
      ) : (
        <div className="mt-3 divide-y divide-ink/10 rounded-md border border-ink/10 bg-paper">
          {events.map((e) => {
            const isOrganizer = !!organizerPinFor(e.slug);
            return (
              <div key={e.slug} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-ink">{e.name}</span>
                    {isOrganizer && (
                      <span className="shrink-0 rounded-sm bg-brass/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em] text-brass">
                        Organizer
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-3 text-[12px] font-semibold uppercase tracking-[0.12em]">
                    <a href={`/e/${e.slug}`} className="text-pine underline decoration-brass underline-offset-2">
                      Board
                    </a>
                    {e.teamCode && (
                      <a
                        href={`/e/${e.slug}/t/${e.teamCode}`}
                        className="text-pine underline decoration-brass underline-offset-2"
                      >
                        Scorecard{e.teamName ? ` (${e.teamName})` : ""}
                      </a>
                    )}
                    {isOrganizer && (
                      <a
                        href={`/e/${e.slug}/admin`}
                        className="text-pine underline decoration-brass underline-offset-2"
                      >
                        Edit event
                      </a>
                    )}
                  </div>
                </div>
                <button
                  aria-label={`Remove ${e.name} from this list`}
                  className="shrink-0 rounded-sm px-2 py-1 text-putty transition-colors hover:bg-linen/60 hover:text-clay"
                  onClick={() => {
                    forgetEvent(e.slug);
                    setEvents(listRecentEvents());
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <div className="flex gap-2">
          <input
            placeholder="Paste an event link or code"
            className="w-full rounded-sm border border-ink/20 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-putty/70 focus:border-brass focus:outline-none"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setInputError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && openInput()}
          />
          <button
            onClick={openInput}
            className="shrink-0 rounded-sm border border-ink/25 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink transition-colors hover:bg-linen/60"
          >
            Open
          </button>
        </div>
        {inputError && <p className="mt-1.5 text-[12px] text-clay">{inputError}</p>}
      </div>
    </section>
  );
}
