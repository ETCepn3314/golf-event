"use client";

import { useEffect, useRef, useState } from "react";
import type { Branding } from "@/lib/branding";

export interface LeaderboardData {
  event: {
    name: string;
    format: string;
    status: string;
    rulesNotes?: string | null;
    branding?: Branding | null;
  };
  generatedAt: string;
  pot: number;
  payoutsFinal: boolean;
  leaderboard: {
    teamId: string;
    teamName: string;
    position: number;
    tied: boolean;
    thru: number;
    total: number;
    vsPar: number | null;
    holeDetails: {
      holeNumber: number;
      par: number;
      complete: boolean;
      value: number | null;
      playerStrokes: { playerId: string; strokes: number | null }[];
    }[];
  }[];
  payouts: { teamId: string; teamName: string; placeLabel: string; amount: number }[];
  players: { id: string; teamId: string; name: string }[];
  contests: { id: string; name: string; prizeAmount: number; winnerName: string | null }[];
}

/** Polls the leaderboard endpoint; keeps the last good data on failures. */
export function useLeaderboard(slug: string, intervalMs = 10000) {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/events/${slug}/leaderboard`);
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          throw new Error(j.error ?? `Error ${res.status}`);
        }
        const json = await res.json();
        if (!cancelled) {
          setData(json);
          setError(null);
          setLastUpdated(Date.now());
        }
      } catch (e) {
        if (!cancelled && !data) {
          setError(e instanceof Error ? e.message : String(e));
        }
        // With data already shown, fail silently and keep polling.
      }
    }
    poll();
    timer.current = setInterval(poll, intervalMs);
    return () => {
      cancelled = true;
      if (timer.current) clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, intervalMs]);

  return { data, error, lastUpdated };
}

export function formatVsPar(vsPar: number | null): string {
  if (vsPar === null) return "";
  if (vsPar === 0) return "E";
  return vsPar > 0 ? `+${vsPar}` : String(vsPar);
}

export function formatMoney(amount: number): string {
  return amount % 1 === 0 ? `$${amount}` : `$${amount.toFixed(2)}`;
}
