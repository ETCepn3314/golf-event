"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listRecentEvents,
  organizerPinFor,
} from "@/lib/client/recentEvents";

export type EventNavTab = "board" | "money" | "score" | "admin";

/**
 * Shared navigation strip for all event pages. The Scorecard tab appears only
 * when this device has a team link for the event; Admin is always reachable
 * (it's PIN-gated) but highlighted when the device holds the organizer PIN.
 */
export function EventNav({ slug, active }: { slug: string; active: EventNavTab }) {
  const [teamCode, setTeamCode] = useState<string | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);

  useEffect(() => {
    // localStorage is only readable after mount; the pre-hydration render
    // intentionally shows the tabs without device-specific links.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTeamCode(listRecentEvents().find((e) => e.slug === slug)?.teamCode ?? null);
    setIsOrganizer(!!organizerPinFor(slug));
  }, [slug]);

  const tabs: { id: EventNavTab; label: string; href: string; show: boolean }[] = [
    { id: "board", label: "Board", href: `/e/${slug}`, show: true },
    { id: "money", label: "Money", href: `/e/${slug}/money`, show: true },
    {
      id: "score",
      label: "Scorecard",
      href: `/e/${slug}/t/${teamCode}`,
      show: teamCode !== null,
    },
    { id: "admin", label: "Admin", href: `/e/${slug}/admin`, show: isOrganizer || active === "admin" },
  ];

  return (
    <nav className="mb-4 flex items-center gap-1 border-b border-ink/10 pb-2">
      <Link
        href="/"
        aria-label="Home"
        className="mr-1 flex h-8 w-8 items-center justify-center rounded-sm text-putty transition-colors hover:bg-linen/60 hover:text-ink"
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6" aria-hidden="true">
          <path d="M2.5 7.5 8 2.5l5.5 5v6h-4v-4h-3v4h-4v-6Z" strokeLinejoin="round" />
        </svg>
      </Link>
      {tabs
        .filter((t) => t.show)
        .map((t) =>
          t.id === active ? (
            <span
              key={t.id}
              className="rounded-sm bg-pine px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-cream"
            >
              {t.label}
            </span>
          ) : (
            <Link
              key={t.id}
              href={t.href}
              className="rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-putty transition-colors hover:bg-linen/60 hover:text-ink"
            >
              {t.label}
            </Link>
          )
        )}
    </nav>
  );
}
