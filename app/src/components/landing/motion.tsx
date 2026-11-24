"use client";

import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

/** Fades and lifts its children in when they scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -80px 0px" }}
      transition={{ duration: 0.7, delay, ease }}
    >
      {children}
    </motion.div>
  );
}

/** Drifts its children against the scroll for a little depth. */
export function Parallax({
  children,
  distance = 50,
  className,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const y = useSpring(useTransform(scrollY, [0, 700], [0, -distance]), {
    stiffness: 90,
    damping: 24,
    mass: 0.4,
  });
  return (
    <motion.div className={className} style={reduce ? undefined : { y }}>
      {children}
    </motion.div>
  );
}

/** An endless strip of short phrases. */
export function Marquee({ items }: { items: string[] }) {
  const row = [...items, ...items];
  return (
    <div className="border-line bg-surface/60 overflow-hidden border-y py-4" aria-hidden="true">
      <div className="ticker-track flex w-max items-center gap-10 whitespace-nowrap">
        {row.map((item, index) => (
          <span
            key={index}
            className="text-muted flex items-center gap-10 font-[family-name:var(--font-display)] text-lg font-bold"
          >
            {item}
            <span className="bg-brand/50 size-1.5 rounded-full" />
          </span>
        ))}
      </div>
    </div>
  );
}

export type Round = {
  tag: string;
  kicker: string;
  title: string;
  text: string;
  tone: string;
  img: string;
  alt: string;
};

const toneBg: Record<string, string> = {
  sun: "bg-sun/25 text-[#8a5a00] dark:text-sun",
  sky: "bg-sealed/10 text-sealed",
  pop: "bg-pop/10 text-pop",
  mint: "bg-mint/20 text-[#0b7a6d] dark:text-mint",
};

function RoundCard({ round, className }: { round: Round; className?: string }) {
  return (
    <article className={`gcard flex flex-col overflow-hidden p-2 ${className ?? ""}`}>
      <Image
        src={round.img}
        alt={round.alt}
        width={1600}
        height={900}
        sizes="(min-width: 1024px) 420px, (min-width: 768px) 45vw, 92vw"
        className="aspect-[16/10] w-full rounded-[18px] object-cover"
      />
      <div className="flex flex-1 flex-col p-5">
        <span
          className={`${toneBg[round.tone]} inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-extrabold tracking-wide uppercase`}
        >
          {round.tag} · {round.kicker}
        </span>
        <h3 className="mt-4 text-2xl">{round.title}</h3>
        <p className="text-muted mt-2 text-sm leading-6 font-semibold">{round.text}</p>
      </div>
    </article>
  );
}

/** Four steps: a pinned horizontal scroll on large screens, a plain grid below. */
export function HorizontalRounds({ rounds }: { rounds: Round[] }) {
  const reduce = useReducedMotion();
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const max = useMotionValue(0);
  const { scrollYProgress } = useScroll({ target: section, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 110, damping: 28, mass: 0.4 });
  const x = useTransform([smooth, max], ([p, m]: number[]) => -(p ?? 0) * (m ?? 0));
  const bar = useTransform(smooth, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    const measure = () => {
      const isWide = window.innerWidth >= 1024 && !reduce;
      setWide(isWide);
      if (track.current) {
        max.set(Math.max(0, track.current.scrollWidth - window.innerWidth + 80));
      }
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [max, reduce]);

  const heading = (
    <div className="mb-10 max-w-2xl">
      <span className="micro-label text-brand">Everyone drops in. One winner.</span>
      <h2 className="mt-3 text-4xl sm:text-5xl">How a round plays</h2>
    </div>
  );

  if (!wide) {
    return (
      <section className="border-line bg-surface/70 border-y">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          {heading}
          <div className="grid gap-5 md:grid-cols-2">
            {rounds.map((round) => (
              <Reveal key={round.tag}>
                <RoundCard round={round} className="h-full" />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      ref={section}
      className="border-line bg-surface/70 relative border-y"
      style={{ height: "300vh" }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-8">{heading}</div>
        <motion.div
          ref={track}
          style={{ x }}
          className="flex w-max gap-6 px-8 will-change-transform"
        >
          {rounds.map((round) => (
            <RoundCard key={round.tag} round={round} className="w-[420px] shrink-0" />
          ))}
        </motion.div>
        <div className="mx-auto mt-10 w-full max-w-7xl px-8">
          <div className="bg-line h-1.5 w-full max-w-xs overflow-hidden rounded-full">
            <motion.div className="bg-brand h-full rounded-full" style={{ width: bar }} />
          </div>
        </div>
      </div>
    </section>
  );
}
