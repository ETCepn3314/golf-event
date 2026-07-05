import Link from "next/link";
import { Button, Card } from "@/components/ui";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-8 text-center">
        <div className="text-5xl">⛳</div>
        <h1 className="mt-3 text-3xl font-bold text-emerald-900">Golf Event</h1>
        <p className="mt-2 text-slate-600">
          Live scoring, leaderboard, and payouts for your golf outing. No app, no accounts — just links.
        </p>
      </div>

      <Link href="/new">
        <Button className="w-full text-lg">Create an event</Button>
      </Link>

      <Card className="mt-6 space-y-3 text-sm text-slate-600">
        <div className="flex gap-3">
          <span className="font-bold text-emerald-700">1.</span>
          <span>Set up your event: course, format (scramble, stroke play, best ball, or Stableford), teams, entry fee, and payouts.</span>
        </div>
        <div className="flex gap-3">
          <span className="font-bold text-emerald-700">2.</span>
          <span>Text each foursome their scoring link. They enter scores after every hole.</span>
        </div>
        <div className="flex gap-3">
          <span className="font-bold text-emerald-700">3.</span>
          <span>Everyone watches the live leaderboard and money board update as scores come in.</span>
        </div>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-400">
        Joining an event? Open the link your organizer sent you.
      </p>
    </main>
  );
}
