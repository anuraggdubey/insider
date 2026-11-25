"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";

const CupRuntime = dynamic(() => import("./cup-runtime"), {
  ssr: false,
  loading: () => (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">Loading the cup…</main>
  ),
});

export function CupEntry() {
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  if (process.env.NEXT_PUBLIC_CUP_URL || fixture) return <CupRuntime />;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10 sm:px-8 lg:py-14">
      <div className="micro-label text-whale">Competition / Alpha Cup</div>
      <h1 className="mt-3 text-4xl font-medium tracking-tight sm:text-5xl">
        Five rounds. Real prizes.
      </h1>
      <p className="text-muted mt-3 max-w-xl text-sm leading-6">
        Human seats buy in privately, play five rounds and the top three are paid privately:
        50/30/20 (60/40 for two, all for one) after a 5% platform fee. Bots and analysts cannot win.
      </p>
      <section
        className="border-line bg-surface mt-10 rounded-lg border p-7"
        aria-label="Cup operator offline"
      >
        <div className="micro-label">Cup / unavailable</div>
        <h2 className="mt-3 text-xl font-medium">Cup operator offline</h2>
        <p className="text-muted mt-2 text-sm">
          The operator is not configured. No buy-in or standings are available.
        </p>
      </section>
    </main>
  );
}
