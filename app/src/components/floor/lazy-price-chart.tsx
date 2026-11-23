"use client";

import dynamic from "next/dynamic";
import { Panel } from "@/components/ui/panel";
import { Skeleton } from "@/components/ui/skeleton";

export const PriceChart = dynamic(
  () => import("./price-chart").then((module) => module.PriceChart),
  {
    ssr: false,
    loading: () => (
      <Panel
        className="h-[470px] min-[1440px]:flex min-[1440px]:h-full min-[1440px]:min-h-0 min-[1440px]:flex-col"
        aria-busy="true"
        aria-label="Loading price chart"
      >
        <div className="border-line flex h-[73px] items-center border-b px-5">
          <span className="micro-label">Floor / virtual market</span>
        </div>
        <span className="sr-only" role="status">
          Loading price chart…
        </span>
        <Skeleton className="m-4 h-[340px] min-[1440px]:min-h-0 min-[1440px]:flex-1" />
      </Panel>
    ),
  },
);
