import type { Metadata } from "next";
import { headers } from "next/headers";
import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { XrayView } from "@/components/xray/xray-view";
import { parseOgParams } from "@/lib/og";

type Props = {
  params: Promise<{ round: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const instant = false;

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { round } = await params;
  const search = await searchParams;
  const query = new URLSearchParams();
  for (const name of ["title", "line", "pnl", "kind", "seat"]) {
    if (typeof search[name] === "string") query.set(name, search[name]);
  }
  query.set("round", round);
  const parsed = parseOgParams(query);
  const path = parsed.success ? `/api/og?${query}` : "/api/og";
  const requestHeaders = await headers();
  const host = (
    requestHeaders.get("x-forwarded-host") ??
    requestHeaders.get("host") ??
    "localhost:3000"
  )
    .split(",")[0]!
    .trim();
  const protocol =
    requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ??
    (host.startsWith("localhost") ? "http" : "https");
  let image: string;
  try {
    const base = new URL(`${protocol === "http" ? "http" : "https"}://${host}`);
    if (base.username || base.password || base.pathname !== "/" || base.search || base.hash)
      throw new Error("Invalid host");
    image = new URL(path, base).href;
  } catch {
    image = new URL(path, "http://localhost:3000").href;
  }
  return {
    title: parsed.success ? `Round ${round} X-ray | INSIDER` : "X-ray | INSIDER",
    description: "Replay the public record of orders, Leaks and sandwiches after the round.",
    openGraph: { images: [{ url: image, width: 1200, height: 630 }] },
  };
}

async function RoundContent({ params }: Pick<Props, "params">) {
  const { round } = await params;
  const parsed = parseOgParams(new URLSearchParams({ round }));
  const roundNumber = parsed.success ? Number(round) : -1;
  return <XrayView roundNumber={roundNumber} />;
}

export default function RoundPage({ params }: Props) {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <RoundContent params={params} />
    </Suspense>
  );
}
