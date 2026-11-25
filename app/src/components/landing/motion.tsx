"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function LandingMotion({ children }: { children: ReactNode }) {
  return children;
}

export function Reveal({
  children,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    node.dataset.reveal = "waiting";
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          node.dataset.reveal = "visible";
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -40px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

function useScrollMotion(kind: "parallax" | "hero" | "scale" | "band", amount = 50) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = ref.current;
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    if (!node) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        if (media.matches || document.hidden) {
          node.style.transform = "";
          node.style.opacity = "";
          return;
        }
        const rect = node.getBoundingClientRect();
        if (rect.bottom < -innerHeight || rect.top > innerHeight * 2) return;
        if (kind === "hero") {
          const p = Math.min(1, scrollY / 520);
          node.style.transform = `translateY(${-50 * p}px) scale(${1 - 0.06 * p})`;
          node.style.opacity = String(1 - 0.85 * p);
        } else if (kind === "parallax")
          node.style.transform = `translateY(${-Math.min(1, scrollY / 700) * amount}px)`;
        else if (kind === "scale") {
          const p = Math.max(0, Math.min(1, (innerHeight - rect.top) / (innerHeight * 0.75)));
          node.style.transform = `scale(${0.92 + 0.08 * p})`;
          node.style.opacity = String(0.5 + 0.5 * p);
        } else
          node.style.transform = `translateX(${Math.max(-150, Math.min(150, ((innerHeight / 2 - rect.top) * amount) / 1000))}px)`;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    media.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      media.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [kind, amount]);
  return ref;
}
export function Parallax({
  children,
  className,
  distance = 50,
}: {
  children: ReactNode;
  distance?: number;
  className?: string;
}) {
  const ref = useScrollMotion("parallax", distance);
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
export function ScaleIn({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useScrollMotion("scale");
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
export function HeroFade({ children, className }: { children: ReactNode; className?: string }) {
  const ref = useScrollMotion("hero");
  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
export function ScrollBand({ top, bottom }: { top: string; bottom: string }) {
  const first = useScrollMotion("band", -80);
  const second = useScrollMotion("band", 80);
  return (
    <div aria-hidden className="border-line bg-surface/60 overflow-hidden border-y py-8">
      <div className="mx-auto max-w-7xl space-y-2 px-5 text-[clamp(2rem,7vw,6.5rem)] leading-none font-extrabold tracking-tight sm:px-8">
        <div ref={first}>
          {top} <span className="text-brand">✦</span>
        </div>
        <div
          ref={second}
          className="text-transparent [-webkit-text-stroke:2px_var(--color-line-strong)]"
        >
          {bottom}
        </div>
      </div>
    </div>
  );
}
export function Marquee({ items }: { items: string[] }) {
  return (
    <div className="border-line overflow-hidden border-y py-4" aria-hidden>
      <div className="text-muted flex gap-10 font-mono text-sm">{items.join(" / ")}</div>
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
function RoundCard({ round }: { round: Round }) {
  return (
    <article className="gcard flex h-full flex-col overflow-hidden p-1.5">
      <Image
        src={round.img}
        alt={round.alt}
        width={1600}
        height={900}
        sizes="(min-width: 1024px) 540px, (min-width: 768px) 45vw, 92vw"
        className="aspect-[16/10] w-full rounded-md object-cover"
      />
      <div className="flex flex-1 flex-col p-5">
        <span className="micro-label text-sealed">
          {round.tag} / {round.kicker}
        </span>
        <h3 className="mt-4 text-2xl">{round.title}</h3>
        <p className="text-muted mt-2 text-sm leading-6">{round.text}</p>
      </div>
    </article>
  );
}

export function HorizontalRounds({ rounds }: { rounds: Round[] }) {
  const section = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [height, setHeight] = useState(0);
  const [step, setStep] = useState(1);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const check = () => setWide(innerWidth >= 768 && !media.matches);
    check();
    window.addEventListener("resize", check);
    media.addEventListener("change", check);
    return () => {
      window.removeEventListener("resize", check);
      media.removeEventListener("change", check);
    };
  }, []);
  useEffect(() => {
    if (!wide) return;
    let frame = 0;
    const measure = () => {
      if (!track.current) return;
      setHeight(Math.max(0, track.current.scrollWidth - innerWidth + 80) * 1.5 + innerHeight);
    };
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const target = section.current;
        const row = track.current;
        if (!target || !row) return;
        const travel = Math.max(0, row.scrollWidth - innerWidth + 80);
        const progress = Math.max(
          0,
          Math.min(
            1,
            -target.getBoundingClientRect().top / Math.max(1, target.offsetHeight - innerHeight),
          ),
        );
        row.style.transform = `translate3d(${-travel * progress}px,0,0)`;
        if (bar.current) bar.current.style.transform = `scaleX(${progress})`;
        setStep(Math.min(rounds.length, Math.floor(progress * rounds.length) + 1));
      });
    };
    measure();
    update();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", update, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", update);
    };
  }, [wide, rounds.length]);
  const heading = (
    <div className="mb-10 max-w-2xl">
      <span className="micro-label text-sealed">The round / 05 steps</span>
      <h2 className="mt-3 text-4xl sm:text-5xl">How a round works.</h2>
    </div>
  );
  if (!wide)
    return (
      <section ref={section} className="border-line bg-surface/70 border-y">
        <div className="mx-auto max-w-7xl px-5 py-16 sm:px-8">
          {heading}
          <div className="grid gap-5 md:grid-cols-2">
            {rounds.map((round) => (
              <Reveal key={round.tag}>
                <RoundCard round={round} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    );
  return (
    <section
      ref={section}
      className="border-line bg-surface/70 relative border-y"
      style={{ height: height || "300vh" }}
    >
      <div className="sticky top-0 flex h-screen flex-col justify-center overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-8">{heading}</div>
        <div ref={track} className="flex w-max gap-6 px-8 will-change-transform">
          {rounds.map((round) => (
            <div key={round.tag} className="w-[min(540px,78vw)] shrink-0">
              <RoundCard round={round} />
            </div>
          ))}
        </div>
        <div className="mx-auto mt-10 flex w-full max-w-7xl items-center gap-4 px-8">
          <span className="text-muted font-mono text-sm tabular-nums">
            {String(step).padStart(2, "0")} / {String(rounds.length).padStart(2, "0")}
          </span>
          <div className="bg-line h-1.5 w-full max-w-xs overflow-hidden rounded-full">
            <div
              ref={bar}
              className="bg-brand h-full origin-left"
              style={{ transform: "scaleX(0)" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
