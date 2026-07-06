"use client";

/**
 * Device-local registry of events this browser has touched, so organizers and
 * players can find their way back without digging up the link. Event slugs are
 * unguessable by design, so this never exposes anything the device didn't
 * already know.
 */

export interface RecentEvent {
  slug: string;
  name: string;
  /** Present when this device scored for a team. */
  teamCode?: string;
  teamName?: string;
  visitedAt: number;
}

const KEY = "golf-recent-events";

export function listRecentEvents(): RecentEvent[] {
  try {
    const list: RecentEvent[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return list.sort((a, b) => b.visitedAt - a.visitedAt);
  } catch {
    return [];
  }
}

export function rememberEvent(entry: Omit<RecentEvent, "visitedAt">) {
  const list = listRecentEvents();
  const existing = list.find((e) => e.slug === entry.slug);
  const merged: RecentEvent = {
    ...existing,
    ...entry,
    // Keep a known team code if the new visit didn't come through a team link.
    teamCode: entry.teamCode ?? existing?.teamCode,
    teamName: entry.teamName ?? existing?.teamName,
    visitedAt: Date.now(),
  };
  const next = [merged, ...list.filter((e) => e.slug !== entry.slug)].slice(0, 20);
  localStorage.setItem(KEY, JSON.stringify(next));
}

export function forgetEvent(slug: string) {
  localStorage.setItem(
    KEY,
    JSON.stringify(listRecentEvents().filter((e) => e.slug !== slug))
  );
}

/** The organizer PIN this device saved for an event, if any. */
export function organizerPinFor(slug: string): string | null {
  return localStorage.getItem(`org-pin-${slug}`);
}

/**
 * Parse anything a user might paste — a leaderboard link, a team link, or a
 * bare slug — into a route within this app. Returns null if unrecognizable.
 */
export function parseEventInput(raw: string): string | null {
  const input = raw.trim();
  if (!input) return null;
  const urlMatch = input.match(/\/e\/([a-z0-9-]+)(?:\/(t\/[A-Z0-9]+|admin|money))?/i);
  if (urlMatch) {
    return `/e/${urlMatch[1]}${urlMatch[2] ? `/${urlMatch[2]}` : ""}`;
  }
  if (/^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/i.test(input)) {
    return `/e/${input}`;
  }
  return null;
}
