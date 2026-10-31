import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/facility";
import { loadAccountVenue } from "@/lib/account-venue";
import { canOpenHostDashboard, isPublicBooker } from "@/lib/host-access";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const photoFrame =
  "h-auto w-full rounded-[1.25rem] object-cover shadow-[0_24px_50px_-32px_rgba(20,33,15,0.5)]";

export default async function HomePage() {
  let signedIn = false;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const booker = isPublicBooker(user);
      const venue = booker ? await loadAccountVenue(user.id, supabase) : null;
      signedIn = canOpenHostDashboard({
        isPublicBooker: booker,
        hasVenue: Boolean(venue),
      });
    }
  }

  const ctaHref = signedIn ? "/dashboard" : "/login";
  const ctaLabel = signedIn ? "Open dashboard" : "Host login";
  const tournamentHref = signedIn ? "/tournament" : "/login?next=/tournament";

  return (
    <main className="page-canvas motion-safe:scroll-smooth">
      <LandingNav ctaHref={ctaHref} ctaLabel={ctaLabel} />

      <section className="mx-auto max-w-6xl px-6 pb-16 pt-10 md:pt-16">
        <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-rise space-y-6">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              For pickleball clubs
            </p>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-6xl">
              One board for open play, tournaments, and court hours.
            </h1>
            <p className="max-w-xl text-lg text-[var(--muted)]">
              Players use a phone. The gym watches the TV. You send the next
              group, keep the draw moving, and confirm a booking before a court
              is held.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <Button size="lg" asChild>
                <Link href={ctaHref}>{ctaLabel}</Link>
              </Button>
              <a
                href="#open-play"
                className="text-sm font-medium text-[var(--accent)] underline underline-offset-4"
              >
                See how a session runs
              </a>
            </div>
          </div>
          <Shot
            src="/assets/open-play-wallboard.jpg"
            alt="Players on the sideline watching the open play board on a gym TV, with courts and the queue behind them."
            width={2528}
            height={1684}
            priority
            brief="Gym TV during open play: courts in use, who is on them, and the queue, with players waiting on the sideline."
          />
        </div>

        <div className="mt-14 grid gap-4 md:grid-cols-3">
          {products.map((product) => (
            <a
              key={product.href}
              href={product.href}
              className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)]/80 p-5 transition hover:border-[var(--accent)]"
            >
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--accent)]">
                {product.kicker}
              </p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--ink)]">
                {product.title}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                {product.body}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section id="open-play" className="border-t border-[var(--border)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-2xl space-y-4">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              Open Play OS
            </p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
              Saturday open play, without the whiteboard.
            </h2>
            <p className="text-lg text-[var(--muted)]">
              A player scans the session QR, gives a name and a skill, and sees
              their place in the queue. You send the next group. The same list
              is on every phone and on the gym TV.
            </p>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {openPlaySteps.map((step, index) => (
              <article
                key={step.title}
                className="flex flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)]/75 p-5 md:p-6"
              >
                <div>
                  <p className="text-xs tabular-nums tracking-[0.22em] text-[var(--accent)]">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 text-[var(--muted)]">{step.body}</p>
                </div>
                <div className="mt-auto">{step.media}</div>
              </article>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
            Before anyone joins, you pick the session: Balanced, All Random,
            Rated Match, Court Kings, Skill Exclusive Courts, Last Man Standing,
            Social Shuffle, or Couple Hunt. Doubles or singles.
          </p>
        </div>
      </section>

      <section
        id="tournament"
        className="border-t border-[var(--border)] py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
            <div className="max-w-xl space-y-5">
              <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
                Tournament Mode
              </p>
              <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
                Several categories. The courts you actually have.
              </h2>
              <p className="text-lg text-[var(--muted)]">
                Mixed, novice, and intermediate can share the gym. You assign
                courts to each category. Pools feed a bracket. Umpires enter
                points only for the court they claimed. Everyone else follows
                one link, with no account.
              </p>
              <Button size="lg" asChild>
                <Link href={tournamentHref}>Run a tournament</Link>
              </Button>
            </div>
            <Shot
              src="/assets/tournament-gym-board.jpg"
              alt="A player checking the tournament on a phone while the same board, with live courts and brackets, is on the gym TV."
              width={2752}
              height={1536}
              brief="A player in the gym, phone in hand, with the same tournament board on the wall TV: live courts and the bracket."
            />
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {tournamentBlocks.map((block, index) => (
              <article
                key={block.title}
                className="flex flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)]/75 p-5 md:p-6"
              >
                <div>
                  <p className="text-xs tabular-nums tracking-[0.22em] text-[var(--accent)]">
                    0{index + 1}
                  </p>
                  <h3 className="mt-2 font-[family-name:var(--font-display)] text-3xl">
                    {block.title}
                  </h3>
                  <p className="mt-3 text-[var(--muted)]">{block.body}</p>
                </div>
                <div className="mt-auto">{block.media}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        id="court-rentals"
        className="border-t border-[var(--border)] py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="max-w-xl space-y-4">
            <p className="text-sm uppercase tracking-[0.28em] text-[var(--accent)]">
              Court rentals and coaching
            </p>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--ink)] md:text-5xl">
              Court hours and lessons, off the group chat.
            </h2>
            <p className="text-lg text-[var(--muted)]">
              Your public link has two tabs. Court rental is consecutive open
              hours on one court. Coaching is a coach&apos;s weekly hours and
              hourly rate, then a court that is still free. The player signs in
              with Google and sends a request. Nothing is held until you accept
              it.
            </p>
          </div>
          <div className="mt-10 grid items-start gap-6 md:grid-cols-[minmax(0,2752fr)_minmax(0,2400fr)]">
            <Shot
              src="/assets/05-booking-phone.jpeg"
              alt="A player in the gym holding a phone on the public court rental page, with Court 1 hours selected and a Google sign-in for John Doe."
              width={2752}
              height={1536}
              brief="The public booking page, in the gym: consecutive open hours on one court, then Google sign-in before the request is sent."
            />
            <Shot
              src="/assets/06-host-approve.jpeg"
              alt="A monitor at the club desk showing John Doe's Tuesday court request selected, with Approve and Decline ready."
              width={2400}
              height={1792}
              brief="The host schedule in the gym: pending requests in amber. Approve holds the court. Decline sends it back."
            />
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {rentalFacts.map((fact) => (
              <article
                key={fact.title}
                className="rounded-[1.5rem] border border-[var(--border)] bg-[var(--surface)]/75 p-5"
              >
                <h3 className="font-[family-name:var(--font-display)] text-2xl">
                  {fact.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                  {fact.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-5 px-6 py-16 md:flex-row md:items-center md:justify-between">
          <div className="max-w-xl space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-[var(--ink)]">
              Put the board up before the doors open.
            </h2>
            <p className="text-[var(--muted)]">
              Hosts sign in. Players join a session from a QR, or request a
              court from your public link.
            </p>
          </div>
          <Button size="lg" asChild>
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl items-center justify-between border-t border-[var(--border)] px-6 py-8 text-sm text-[var(--muted)]">
        <span>{PRODUCT_NAME}</span>
        <span>Open play, tournaments, and bookings</span>
      </footer>
    </main>
  );
}

const products = [
  {
    href: "#open-play",
    kicker: "Open Play OS",
    title: "A fair queue, on the TV",
    body: "Check-in, the next group, and every court stay in sync from the QR to the wallboard.",
  },
  {
    href: "#tournament",
    kicker: "Tournament Mode",
    title: "A draw that fits the gym",
    body: "Categories share courts. Umpires score from the court. One public link shows the rest.",
  },
  {
    href: "#court-rentals",
    kicker: "Court rentals and coaching",
    title: "Requests you confirm",
    body: "Players ask for hours or a coach. You accept before the court is held.",
  },
];

const openPlaySteps = [
  {
    title: "Players check themselves in",
    body: "The QR opens the session. A name and a skill are enough. They see their spot in the queue, and whether they are on a court. Couple Hunt also asks for a gender, because every team is mixed and no couple repeats.",
    media: (
      <Shot
        src="/assets/01-player-checkin.jpeg"
        alt="A player holding a phone at the court gate, checking in as Sofia with skill Intermediate, while the session QR hangs on the fence."
        width={2400}
        height={1792}
        brief="Check-in on a phone at the gate: name, skill, and the queue, with the session QR on the fence."
      />
    ),
  },
  {
    title: "You send the next group",
    body: "The host console takes the players with the fewest games and the longest wait, then avoids repeat partners and opponents. You can lock two players as partners, or lock a whole team, before they go out.",
    media: (
      <Shot
        src="/assets/02-send-next-group.jpeg"
        alt="A host holding a tablet at the desk, with live courts, partner lock, and team lock on screen, and players on the courts behind."
        width={2400}
        height={1792}
        brief="The host desk: live courts, partner lock, and team lock, with the session playing behind the tablet."
      />
    ),
  },
  {
    title: "The gym hears the court",
    body: "Set a maximum game length. The court tile counts down. The TV calls a two-minute warning and when time is up. From the host desk you can also call the next group to get ready, by name.",
    media: (
      <Shot
        src="/assets/03-gym-hears-court.jpeg"
        alt="Players leaving court 4 while the gym TV shows the open play board, with live courts and the queue."
        width={2400}
        height={1792}
        brief="The open-play board on the gym TV beside the court, queue on the right, players coming off court 4."
      />
    ),
  },
  {
    title: "A rental still owns the court",
    body: "A confirmed booking shows on the open-play board as reserved. That court is not treated as free, and the next group is not sent onto it. If a game is already going when the booking starts, the tile says it is the last game on that court.",
    media: (
      <Shot
        src="/assets/04-court-rentals.jpeg"
        alt="Players waiting beside the courts while the gym TV shows court 3 booked for John Doe from 3:00 to 6:00 PM, reserved and not in open play."
        width={2400}
        height={1792}
        brief="Court 3 booked for a named block on the gym TV. The other courts stay live, and the queue stays on the right."
      />
    ),
  },
];

const tournamentBlocks = [
  {
    title: "Categories share the courts",
    body: "You choose which courts each category may use. Mixed can be on court 1 while novice is already playing on court 2.",
    media: <SharedCourtsSample />,
  },
  {
    title: "Pools, then a bracket",
    body: "Teams play a pool first. The top finishers move on. If the next round is short a team, leave the spot as a bye or fill it with a wild card: the best team that did not advance, by wins and then point difference.",
    media: <PoolSample />,
  },
  {
    title: "A score from the court",
    body: "Each umpire claims one court and enters only that match. A point on court 1 does not change court 2. When the game ends, the result goes into the standings and, later, the bracket.",
    media: (
      <Shot
        src="/assets/tournament-umpire.jpg"
        alt="An umpire at the scorer's table tapping Point on a tablet, with court 1 playing behind them."
        width={1792}
        height={2400}
        frame="portrait"
        brief="An umpire at the table, tablet showing one court: score, Point, Sideout, and who is serving. The match is playing behind them."
      />
    ),
  },
  {
    title: "A board anyone can open",
    body: "Share one link. Players, families, and the gym TV watch the same page. Games on court, the live score, the standings, and the bracket update as umpires enter points.",
    media: (
      <Shot
        src="/assets/tournament-phone-board.jpg"
        alt="A phone in the gym showing the public tournament board, with the same board on the TV behind it."
        width={1792}
        height={2400}
        frame="portrait"
        brief="A phone in the stands showing the public board, and the same board on the gym TV behind it: courts, standings, and the bracket."
      />
    ),
  },
];

const rentalFacts = [
  {
    title: "Only the hours you publish",
    body: "Open slots follow the hours and timezone you set. Players pick consecutive hours on one court, or a coach's open hours.",
  },
  {
    title: "Pending until you accept",
    body: "The request stays pending. Accept it to hold the court, or decline it with a short reason. The player follows a status link.",
  },
  {
    title: "The price is the coach's rate",
    body: "A coaching request shows an estimate from that coach's hourly rate times the hours chosen, then a court that is still free in that window.",
  },
];

function Shot({
  brief,
  src,
  alt,
  width,
  height,
  priority = false,
  frame = "landscape",
}: {
  brief: string;
  src?: string;
  alt?: string;
  width?: number;
  height?: number;
  priority?: boolean;
  frame?: "landscape" | "portrait";
}) {
  if (src && alt && width && height) {
    return (
      <figure className="space-y-3">
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          priority={priority}
          sizes={
            frame === "portrait"
              ? "(min-width: 768px) 22rem, 80vw"
              : "(min-width: 768px) 42vw, 100vw"
          }
          className={cn(
            photoFrame,
            frame === "portrait" && "mx-auto max-h-[32rem] max-w-sm object-top",
          )}
        />
        <figcaption className="text-sm leading-relaxed text-[var(--muted)]">
          {brief}
        </figcaption>
      </figure>
    );
  }

  return (
    <div
      role="img"
      aria-label={brief}
      className={cn(
        "flex flex-col justify-between rounded-[1.25rem] bg-[var(--ink)] p-5 text-[var(--paper)]",
        frame === "portrait" ? "min-h-72" : "min-h-56",
      )}
    >
      <p className="text-xs uppercase tracking-[0.22em] text-[var(--highlight)]">
        Photo to add
      </p>
      <p className="text-sm leading-relaxed text-white/85">{brief}</p>
    </div>
  );
}

function BoardPanel({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[1.25rem] bg-[var(--ink)] p-5 text-[var(--paper)]">
      <p className="mb-3 text-xs uppercase tracking-[0.3em] text-white/50">
        {label}
      </p>
      {children}
    </div>
  );
}

function ScoreRow({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5">
      <span className="text-sm text-white/80">{name}</span>
      <span className="font-[family-name:var(--font-display)] text-3xl leading-none tabular-nums text-[var(--highlight)]">
        {score}
      </span>
    </div>
  );
}

function SharedCourtsSample() {
  const courts = [
    {
      court: "Court 1",
      meta: "Mixed · M1",
      a: "Smith / Crozier",
      b: "Touzel / Scotti",
      scoreA: 8,
      scoreB: 6,
    },
    {
      court: "Court 2",
      meta: "Womens Novice · M4",
      a: "Torres / Doris",
      b: "Curley / Yang",
      scoreA: 4,
      scoreB: 7,
    },
  ];

  return (
    <BoardPanel label="On court">
      <div className="grid gap-3">
        {courts.map((court) => (
          <article
            key={court.court}
            className="rounded-2xl border border-white/10 bg-white/5 p-4"
          >
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--highlight)]">{court.court}</span>
              <span className="truncate text-white/50">{court.meta}</span>
            </div>
            <ScoreRow name={court.a} score={court.scoreA} />
            <ScoreRow name={court.b} score={court.scoreB} />
          </article>
        ))}
      </div>
    </BoardPanel>
  );
}

function PoolSample() {
  const rows = [
    ["1", "Smith / Crozier", "3", "0", "+18"],
    ["2", "Dobson / Tibbett", "2", "1", "+6"],
    ["3", "Egure / Carrell", "1", "2", "−4"],
  ];

  return (
    <BoardPanel label="Bracket A">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase tracking-[0.14em] text-white/40">
          <tr>
            <th className="py-2 font-medium" scope="col">
              Team
            </th>
            {["W", "L", "+/−"].map((heading) => (
              <th
                key={heading}
                className="py-2 text-right font-medium"
                scope="col"
              >
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row[1]} className="border-t border-white/10">
              <td className="py-2">
                {row[0]}. {row[1]}
                {row[0] === "3" ? (
                  <span className="ml-2 text-xs uppercase tracking-[0.12em] text-white/50">
                    Wild card
                  </span>
                ) : null}
              </td>
              {row.slice(2).map((value, valueIndex) => (
                <td
                  key={`${row[1]}-${valueIndex}`}
                  className="py-2 text-right tabular-nums"
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </BoardPanel>
  );
}
