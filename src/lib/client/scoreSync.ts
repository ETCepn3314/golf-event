"use client";

/**
 * Offline-tolerant score submission queue, backed by localStorage.
 * Entries are keyed by (playerId, holeNumber); re-queuing the same key replaces
 * the pending value. The server upsert is idempotent, so retries and
 * double-sends are harmless.
 */

export interface QueueEntry {
  holeNumber: number;
  playerId: string | null;
  strokes: number | null;
}

export type SyncState = "saved" | "saving" | "pending";

function queueKey(slug: string, code: string) {
  return `golf-queue-${slug}-${code}`;
}

export function loadQueue(slug: string, code: string): QueueEntry[] {
  try {
    return JSON.parse(localStorage.getItem(queueKey(slug, code)) ?? "[]");
  } catch {
    return [];
  }
}

export function saveQueue(slug: string, code: string, queue: QueueEntry[]) {
  localStorage.setItem(queueKey(slug, code), JSON.stringify(queue));
}

export function enqueue(slug: string, code: string, entry: QueueEntry) {
  const queue = loadQueue(slug, code).filter(
    (e) => !(e.playerId === entry.playerId && e.holeNumber === entry.holeNumber)
  );
  queue.push(entry);
  saveQueue(slug, code, queue);
}

function lockQueueKey(slug: string, code: string) {
  return `golf-lockqueue-${slug}-${code}`;
}

export function loadLockQueue(slug: string, code: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(lockQueueKey(slug, code)) ?? "[]");
  } catch {
    return [];
  }
}

/** Queue a hole lock; it rides along with the next score flush. */
export function enqueueLock(slug: string, code: string, holeNumber: number) {
  const queue = loadLockQueue(slug, code);
  if (!queue.includes(holeNumber)) queue.push(holeNumber);
  localStorage.setItem(lockQueueKey(slug, code), JSON.stringify(queue));
}

/**
 * Attempt to POST all pending scores and hole locks.
 * Returns true if both queues are now empty.
 */
export async function flushQueue(slug: string, code: string): Promise<boolean> {
  const queue = loadQueue(slug, code);
  const locks = loadLockQueue(slug, code);
  if (queue.length === 0 && locks.length === 0) return true;
  try {
    const res = await fetch(`/api/events/${slug}/scores`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-team-code": code },
      body: JSON.stringify({
        entries: queue,
        ...(locks.length > 0 ? { lockHoles: locks } : {}),
      }),
    });
    if (!res.ok) return false;
    // Only remove what we sent; new entries may have arrived while in flight.
    const remaining = loadQueue(slug, code).filter(
      (e) =>
        !queue.some(
          (sent) =>
            sent.playerId === e.playerId &&
            sent.holeNumber === e.holeNumber &&
            sent.strokes === e.strokes
        )
    );
    saveQueue(slug, code, remaining);
    const remainingLocks = loadLockQueue(slug, code).filter((h) => !locks.includes(h));
    localStorage.setItem(lockQueueKey(slug, code), JSON.stringify(remainingLocks));
    return remaining.length === 0 && remainingLocks.length === 0;
  } catch {
    return false;
  }
}

/** Local mirror of this team's locked holes. */
export function loadLocalLocks(slug: string, code: string): number[] {
  try {
    return JSON.parse(localStorage.getItem(`golf-locks-${slug}-${code}`) ?? "[]");
  } catch {
    return [];
  }
}

export function saveLocalLocks(slug: string, code: string, locks: number[]) {
  localStorage.setItem(`golf-locks-${slug}-${code}`, JSON.stringify(locks));
}

/** Local mirror of the team's scores so a reload with no signal still shows them. */
export function loadLocalScores(slug: string, code: string): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(`golf-scores-${slug}-${code}`) ?? "{}");
  } catch {
    return {};
  }
}

export function saveLocalScores(slug: string, code: string, scores: Record<string, number>) {
  localStorage.setItem(`golf-scores-${slug}-${code}`, JSON.stringify(scores));
}

export function scoreKey(playerId: string | null, holeNumber: number): string {
  return `${playerId ?? "team"}:${holeNumber}`;
}
