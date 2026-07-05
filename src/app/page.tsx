import Link from "next/link";
import { Pennant } from "@/components/ui";

const STEPS = [
  {
    n: "01",
    title: "Set the terms",
    body: "Course, format — scramble, stroke play, best ball, or Stableford — teams, entry fee, and how the pot pays out.",
  },
  {
    n: "02",
    title: "Send the links",
    body: "Each foursome gets a private scoring link. They post scores after every hole, right from the fairway.",
  },
  {
    n: "03",
    title: "Watch the board",
    body: "One live scoreboard for the whole field — standings, thru, and who's winning the money.",
  },
];

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* Hero */}
      <section className="board-texture bg-pine px-6 pb-16 pt-14 text-cream">
        <div className="mx-auto w-full max-w-md">
          <div className="flex items-center gap-2.5 text-brass-light">
            <Pennant className="h-7 w-5" />
            <span className="text-[12px] font-semibold uppercase tracking-[0.3em]">
              Golf Event
            </span>
          </div>

          <h1 className="mt-8 font-display text-[2.75rem] font-semibold leading-[1.05]">
            Tournament day,
            <br />
            <em className="text-brass-light">handled.</em>
          </h1>
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-cream/75">
            Live scoring, standings, and payouts for your golf outing.
            No apps, no accounts — just links.
          </p>

          <Link
            href="/new"
            className="mt-9 inline-block rounded-sm bg-cream px-8 py-4 text-[13px] font-bold uppercase tracking-[0.16em] text-pine transition-colors hover:bg-brass-light"
          >
            Create an event
          </Link>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto w-full max-w-md flex-1 px-6 py-12">
        <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-putty">
          How it works
        </div>
        <div className="mt-6">
          {STEPS.map((s) => (
            <div key={s.n} className="border-t border-ink/10 py-6 first:border-t-0 first:pt-0">
              <div className="flex items-baseline gap-5">
                <span className="font-display text-2xl font-semibold text-brass">{s.n}</span>
                <div>
                  <h2 className="font-display text-xl font-semibold text-pine">{s.title}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink/70">{s.body}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="rule-double mt-2" />
        <p className="mt-6 text-center text-[13px] text-putty">
          Joining an event? Use the link your organizer sent you.
        </p>
      </section>
    </main>
  );
}
