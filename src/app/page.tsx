import type { ReactNode } from "react";
import Image from "next/image";
import { LandingNav } from "@/components/landing/landing-nav";
import { Reveal } from "@/components/landing/reveal";
import { PendingLink } from "@/components/pending-link";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/env";
import { PRODUCT_NAME } from "@/lib/facility";
import { loadAccountVenue } from "@/lib/account-venue";
import { canOpenHostDashboard, isPublicBooker } from "@/lib/host-access";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

const photoFrame =
  "h-auto w-full rounded-[1.25rem] object-cover shadow-[0_30px_70px_-36px_rgba(0,0,0,0.75)]";

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

      <section className="mx-auto max-w-6xl px-6 pb-8 pt-14 md:pt-20">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="animate-rise space-y-7">
            <Pill>For pickleball clubs</Pill>
            <h1 className="max-w-xl text-5xl font-semibold leading-[1.02] tracking-tight text-[var(--foreground)] md:text-6xl lg:text-7xl">
              One board for <span className="gradient-phrase">open play</span>,{" "}
              <span className="gradient-phrase">tournaments</span>, and{" "}
              <span className="gradient-phrase">court hours</span>.
            </h1>
            <p className="max-w-xl text-lg leading-relaxed text-[var(--muted)]">
              Players use a phone. The gym watches the TV. You send the next
              group, keep the draw moving, and confirm a booking before a court
              is held.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Button size="lg" className="rounded-full" asChild>
                <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="rounded-full"
                asChild
              >
                <a href="#open-play">See how a session runs</a>
              </Button>
            </div>
          </div>
          <div className="animate-rise-delay">
            <HeroCollage />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16" aria-label="The board">
        <div className="flex flex-wrap gap-x-10 gap-y-3 text-sm font-medium tracking-wide text-[var(--muted)]">
          {products.map((product) => (
            <a
              key={product.href}
              href={product.href}
              className="transition hover:text-[var(--foreground)]"
            >
              {product.kicker}
            </a>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-8">
        <Reveal>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--foreground)] md:text-4xl">
            Selected work
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {selectedWork.map((work, index) => (
            <Reveal key={work.src} delay={index * 90}>
              <a
                href={work.href}
                className="group block overflow-hidden rounded-[1.75rem] border border-[var(--border)] bg-[var(--surface)] motion-safe:transition motion-safe:duration-500 motion-safe:hover:-translate-y-1"
              >
                <div className="relative aspect-[16/10]">
                  <Image
                    src={work.src}
                    alt={work.alt}
                    fill
                    sizes="(min-width: 768px) 36rem, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/15 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 space-y-2 p-5 md:p-6">
                    <p className="text-xs font-medium tracking-wide text-white/70">
                      {work.kicker}
                    </p>
                    <h3 className="text-2xl font-semibold text-white">
                      {work.title}
                    </h3>
                    <p className="max-w-md text-sm leading-relaxed text-white/75">
                      {work.body}
                    </p>
                  </div>
                </div>
              </a>
            </Reveal>
          ))}
        </div>
      </section>

      <section id="open-play" className="border-t border-[var(--border)] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-2xl space-y-4">
            <Pill>Open Play OS</Pill>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] md:text-5xl">
              Saturday open play, without the whiteboard.
            </h2>
            <p className="text-lg text-[var(--muted)]">
              A player scans the session QR, gives a name and a skill, and sees
              their place in the queue. You send the next group. The same list
              is on every phone and on the gym TV.
            </p>
          </Reveal>

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {openPlaySteps.map((step, index) => (
              <Reveal key={step.title} delay={(index % 2) * 90}>
                <article className="glow-card flex h-full flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] p-5 md:p-6">
                  <div>
                    <p className="text-xs tabular-nums tracking-[0.22em] text-[var(--accent)]">
                      0{index + 1}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {step.title}
                    </h3>
                    <p className="mt-3 text-[var(--muted)]">{step.body}</p>
                  </div>
                  <div className="mt-auto">{step.media}</div>
                </article>
              </Reveal>
            ))}
          </div>

          <p className="mt-8 max-w-3xl text-sm leading-relaxed text-[var(--muted)]">
            Before anyone joins, you pick the session: Fair Mix, Chaos Draw,
            Rating Band, Winner Path, Skill Lanes, Court Hold, Fresh Partners,
            or Mixed Only. Doubles or singles.
          </p>
        </div>
      </section>

      <section
        id="tournament"
        className="border-t border-[var(--border)] py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid items-center gap-10 md:grid-cols-[1.05fr_0.95fr]">
            <Reveal className="max-w-xl space-y-5">
              <Pill>Tournament Mode</Pill>
              <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] md:text-5xl">
                Several categories. The courts you actually have.
              </h2>
              <p className="text-lg text-[var(--muted)]">
                Mixed, novice, and intermediate can share the gym. You assign
                courts to each category. Pools feed a bracket. Umpires enter
                points only for the court they claimed. Everyone else follows
                one link, with no account.
              </p>
              <Button size="lg" className="rounded-full" asChild>
                <PendingLink href={tournamentHref}>
                  Run a tournament
                </PendingLink>
              </Button>
            </Reveal>
            <Reveal delay={120}>
              <Shot
                src="/assets/tournament-gym-board.jpg"
                alt="A player checking the tournament on a phone while the same board, with live courts and brackets, is on the gym TV."
                width={2752}
                height={1536}
                brief="A player in the gym, phone in hand, with the same tournament board on the wall TV: live courts and the bracket."
              />
            </Reveal>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {tournamentBlocks.map((block, index) => (
              <Reveal key={block.title} delay={(index % 2) * 90}>
                <article className="glow-card flex h-full flex-col gap-5 rounded-[1.75rem] border border-[var(--border)] p-5 md:p-6">
                  <div>
                    <p className="text-xs tabular-nums tracking-[0.22em] text-[var(--accent)]">
                      0{index + 1}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                      {block.title}
                    </h3>
                    <p className="mt-3 text-[var(--muted)]">{block.body}</p>
                  </div>
                  <div className="mt-auto">{block.media}</div>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section
        id="court-rentals"
        className="border-t border-[var(--border)] py-20"
      >
        <div className="mx-auto max-w-6xl px-6">
          <Reveal className="max-w-xl space-y-4">
            <Pill>Court rentals and coaching</Pill>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] md:text-5xl">
              Court hours and lessons, off the group chat.
            </h2>
            <p className="text-lg text-[var(--muted)]">
              Your public link has two tabs. Court rental is consecutive open
              hours on one court. Coaching is a coach&apos;s weekly hours and
              hourly rate, then a court that is still free. The player signs in
              with Google and sends a request. Nothing is held until you accept
              it.
            </p>
          </Reveal>
          <div className="mt-10 grid items-start gap-6 md:grid-cols-[minmax(0,2752fr)_minmax(0,2400fr)]">
            <Reveal>
              <Shot
                src="/assets/05-booking-phone.jpeg"
                alt="A player in the gym holding a phone on the public court rental page, with Court 1 hours selected and a Google sign-in for John Doe."
                width={2752}
                height={1536}
                brief="The public booking page, in the gym: consecutive open hours on one court, then Google sign-in before the request is sent."
              />
            </Reveal>
            <Reveal delay={120}>
              <Shot
                src="/assets/06-host-approve.jpeg"
                alt="A monitor at the club desk showing John Doe's Tuesday court request selected, with Approve and Decline ready."
                width={2400}
                height={1792}
                brief="The host schedule in the gym: pending requests in amber. Approve holds the court. Decline sends it back."
              />
            </Reveal>
          </div>

          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {rentalFacts.map((fact, index) => (
              <Reveal key={fact.title} delay={index * 80}>
                <article className="glow-card h-full rounded-[1.5rem] border border-[var(--border)] p-5">
                  <h3 className="text-xl font-semibold text-[var(--foreground)]">
                    {fact.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {fact.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 py-20 lg:grid-cols-[0.9fr_1.1fr]">
          <Reveal className="max-w-xl space-y-5">
            <Pill>One board</Pill>
            <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] md:text-5xl">
              The gym runs from the same screen.
            </h2>
            <p className="text-lg text-[var(--muted)]">
              Queue, draw, and court hours stay together. Players follow a link.
              You confirm what the TV is allowed to show.
            </p>
            <Button size="lg" className="rounded-full" asChild>
              <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
            </Button>
          </Reveal>
          <div className="grid gap-4 sm:grid-cols-2">
            {capabilities.map((item, index) => (
              <Reveal key={item.title} delay={index * 80}>
                <article className="glow-card h-full rounded-[1.5rem] border border-[var(--border)] p-5">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                    {item.body}
                  </p>
                </article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-6 py-24 text-center">
        <Reveal className="mx-auto max-w-3xl space-y-6">
          <Pill>Before the doors open</Pill>
          <h2 className="text-4xl font-semibold leading-[1.05] tracking-tight text-[var(--foreground)] md:text-6xl">
            Put the <span className="gradient-phrase">board up</span> before the
            first game.
          </h2>
          <p className="mx-auto max-w-xl text-lg text-[var(--muted)]">
            Hosts sign in. Players join a session from a QR, or request a court
            from your public link.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" className="rounded-full" asChild>
              <PendingLink href={ctaHref}>{ctaLabel}</PendingLink>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="rounded-full"
              asChild
            >
              <PendingLink href={tournamentHref}>Run a tournament</PendingLink>
            </Button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-[var(--border)]">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:grid-cols-2 md:grid-cols-4">
          <div className="space-y-3 sm:col-span-2">
            <div
              className="brand-mark brand-mark-nav"
              role="img"
              aria-label={PRODUCT_NAME}
            />
            <p className="max-w-xs text-sm leading-relaxed text-[var(--muted)]">
              Open play, tournaments, and court hours on one board.
            </p>
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-[var(--foreground)]">On the floor</p>
            {products.map((product) => (
              <a
                key={product.href}
                href={product.href}
                className="block text-[var(--muted)] hover:text-[var(--foreground)]"
              >
                {product.kicker}
              </a>
            ))}
          </div>
          <div className="space-y-2 text-sm">
            <p className="font-medium text-[var(--foreground)]">Hosts</p>
            <PendingLink
              href={ctaHref}
              className="block text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              {ctaLabel}
            </PendingLink>
            <PendingLink
              href="/demo"
              className="block text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Local demo
            </PendingLink>
          </div>
        </div>
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

const selectedWork = [
  {
    href: "#open-play",
    kicker: "Open Play OS",
    title: "A fair queue, on the TV",
    body: "Courts in use, who is on them, and the queue, with players waiting on the sideline.",
    src: "/assets/open-play-wallboard.jpg",
    alt: "Players on the sideline watching the open play board on a gym TV, with courts and the queue behind them.",
  },
  {
    href: "#tournament",
    kicker: "Tournament Mode",
    title: "A draw that fits the gym",
    body: "The same tournament board on a phone and on the gym TV: live courts and the bracket.",
    src: "/assets/tournament-gym-board.jpg",
    alt: "A player checking the tournament on a phone while the same board, with live courts and brackets, is on the gym TV.",
  },
  {
    href: "#court-rentals",
    kicker: "Court rentals",
    title: "Hours picked in the gym",
    body: "Consecutive open hours on one court, then Google sign-in before the request is sent.",
    src: "/assets/05-booking-phone.jpeg",
    alt: "A player in the gym holding a phone on the public court rental page, with Court 1 hours selected and a Google sign-in for John Doe.",
  },
  {
    href: "#court-rentals",
    kicker: "Coaching",
    title: "Requests you confirm",
    body: "Pending requests stay amber until you approve. Nothing is held before that.",
    src: "/assets/06-host-approve.jpeg",
    alt: "A monitor at the club desk showing John Doe's Tuesday court request selected, with Approve and Decline ready.",
  },
];

const capabilities = [
  {
    title: "A fair queue",
    body: "The next group comes from the fewest games and the longest wait, without repeat partners.",
  },
  {
    title: "The gym TV",
    body: "Courts, the countdown, and the queue stay on the wall. Phones show the same list.",
  },
  {
    title: "Requests you confirm",
    body: "A court hour or a lesson stays pending until you accept it. Decline sends it back.",
  },
  {
    title: "A score from the court",
    body: "An umpire claims one court and enters only that match. The public link follows along.",
  },
];

function Pill({ children }: { children: ReactNode }) {
  return (
    <p className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs font-medium text-[var(--muted)]">
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--highlight)]"
        aria-hidden
      />
      {children}
    </p>
  );
}

function HeroCollage() {
  return (
    <div className="relative mx-auto mt-4 w-full max-w-xl pb-10 lg:mt-0 lg:max-w-none">
      <div
        aria-hidden
        className="glow-pulse pointer-events-none absolute -inset-8 rounded-full bg-[radial-gradient(circle,var(--wash-strong),transparent_68%)] blur-2xl"
      />
      <div className="relative">
        <Image
          src="/assets/open-play-wallboard.jpg"
          alt="Players on the sideline watching the open play board on a gym TV, with courts and the queue behind them."
          width={2528}
          height={1684}
          priority
          className="h-auto w-full rounded-[1.75rem] object-cover shadow-[0_40px_80px_-40px_rgba(0,0,0,0.85)] ring-1 ring-white/10"
        />
        <Image
          src="/assets/05-booking-phone.jpeg"
          alt="A player in the gym holding a phone on the public court rental page, with Court 1 hours selected."
          width={2752}
          height={1536}
          className="float-slow absolute -bottom-6 left-4 w-[48%] rounded-2xl object-cover shadow-[0_24px_50px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/15"
        />
        <Image
          src="/assets/tournament-gym-board.jpg"
          alt="The tournament board on the gym TV, with live courts and the bracket."
          width={2752}
          height={1536}
          className="float-late absolute -top-5 right-0 w-[42%] rounded-2xl object-cover shadow-[0_24px_50px_-24px_rgba(0,0,0,0.9)] ring-1 ring-white/15"
        />
      </div>
    </div>
  );
}

const openPlaySteps = [
  {
    title: "Players check themselves in",
    body: "The QR opens the session. A name and a skill are enough. They see their spot in the queue, and whether they are on a court. Mixed Only also asks for a gender, because every team is mixed and no pair repeats.",
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
