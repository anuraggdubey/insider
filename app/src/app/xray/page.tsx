"use client";

import { fetchTable, teeConnection, type XrayAccount } from "@insider/sdk";
import { ArrowLeft, ScanLine } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useInsider } from "@/app/providers";
import { FloorSkeleton, TableOffline } from "@/components/floor/states";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { useFloorStore } from "@/lib/floor-store";

function XrayView() {
  const config = useInsider();
  const search = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && search.get("fixture") === "1";
  const fixtureSnapshot = useFloorStore((state) => state.fixture?.snapshot);
  const [xray, setXray] = useState<XrayAccount | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let closed = false;
    const load = async () => {
      try {
        if (fixture) {
          setXray(fixtureSnapshot?.xray ?? null);
        } else if (config.tableAuthority) {
          const snapshot = await fetchTable(await teeConnection(config), config);
          if (!closed) setXray(snapshot?.xray ?? null);
        }
      } finally {
        if (!closed) setLoading(false);
      }
    };
    void load().catch(() => {
      if (!closed) setLoading(false);
    });
    return () => {
      closed = true;
    };
  }, [config, fixture, fixtureSnapshot]);
  if (loading) return <FloorSkeleton />;
  if (!xray) return <TableOffline />;
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-12">
      <Link
        href={fixture ? "/table?fixture=1" : "/table"}
        className="text-muted hover:text-text flex items-center gap-2 font-mono text-[10px]"
      >
        <ArrowLeft className="size-3" /> THE FLOOR
      </Link>
      <div className="mt-10 flex items-end justify-between">
        <div>
          <span className="micro-label text-priority">After the bell</span>
          <h1 className="mt-3 flex items-center gap-3 text-3xl font-medium">
            <ScanLine className="text-priority size-7" /> Round {xray.roundId} X-ray
          </h1>
        </div>
        {fixture && <Badge tone="opened">Fixture</Badge>}
      </div>
      {xray.finalized ? (
        <div className="mt-8 grid grid-cols-3 gap-3">
          {[
            ["Orders revealed", xray.orderCount],
            ["Leaks archived", xray.leakCount],
            ["Sandwich tags", xray.tagCount],
          ].map(([label, value]) => (
            <Panel key={label} className="p-5">
              <div className="micro-label">{label}</div>
              <div className="mt-3 font-mono text-2xl">{value}</div>
            </Panel>
          ))}
        </div>
      ) : (
        <Panel className="mt-8 p-8">
          <h2 className="text-lg">The round is still sealed.</h2>
          <p className="text-muted mt-2 text-sm">
            The public trace appears when this round is finalized.
          </p>
        </Panel>
      )}
      {xray.finalized && (
        <p className="text-muted mt-5 text-sm">
          The X-ray is a public record of the completed round.
        </p>
      )}
    </main>
  );
}

export default function XrayPage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <XrayView />
    </Suspense>
  );
}
