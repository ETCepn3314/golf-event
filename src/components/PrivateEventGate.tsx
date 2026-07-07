"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseEventInput } from "@/lib/client/recentEvents";

/**
 * Shown when this device has no credential for a (private) event. Members reach
 * an event only through the team link their organizer sent — pasting it here
 * takes them to their scorecard, which registers the code for future visits.
 */
export function PrivateEventGate({ slug }: { slug: string }) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function open() {
    const path = parseEventInput(input);
    if (!path || !path.includes("/t/")) {
      setErr("Paste the full team link your organizer texted you (it contains a /t/ code).");
      return;
    }
    router.push(path);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <div className="board-texture rounded-md bg-pine p-6 text-cream">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brass-light">
          Private event
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold leading-tight">
          This board is invite-only
        </h1>
        <p className="mt-3 text-[14px] leading-relaxed text-cream/75">
          Only players who were sent a team link — and the organizer — can see this
          event&apos;s leaderboard and payouts. Open your team link to get in.
        </p>
      </div>

      <div className="mt-5">
        <div className="flex gap-2">
          <input
            placeholder="Paste your team link"
            className="w-full rounded-sm border border-ink/20 bg-paper px-3 py-2.5 text-sm text-ink placeholder:text-putty/70 focus:border-brass focus:outline-none"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setErr(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && open()}
          />
          <button
            onClick={open}
            className="shrink-0 rounded-sm bg-pine px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cream transition-colors hover:bg-moss"
          >
            Open
          </button>
        </div>
        {err && <p className="mt-1.5 text-[12px] text-clay">{err}</p>}
      </div>

      <p className="mt-6 text-center text-[13px] text-putty">
        Organizer?{" "}
        <a
          href={`/e/${slug}/admin`}
          className="font-semibold text-pine underline decoration-brass underline-offset-2"
        >
          Unlock with your PIN
        </a>
      </p>
    </main>
  );
}
