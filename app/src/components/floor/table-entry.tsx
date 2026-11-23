"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { updateFloor } from "@/lib/floor-store";
import { FloorSkeleton, TableOffline } from "./states";

const FloorApp = dynamic(() => import("./floor-app").then((module) => module.FloorApp), {
  ssr: false,
  loading: () => <FloorSkeleton />,
});

export function TableEntry() {
  const params = useSearchParams();
  const fixture = process.env.NODE_ENV !== "production" && params.get("fixture") === "1";
  useEffect(() => {
    if (!fixture && !process.env.NEXT_PUBLIC_TABLE_AUTHORITY)
      updateFloor({
        status: "offline",
        snapshot: null,
        fixture: null,
        pending: [],
        vaults: {},
        error: null,
      });
  }, [fixture]);
  if (!fixture && !process.env.NEXT_PUBLIC_TABLE_AUTHORITY) return <TableOffline />;
  return <FloorApp />;
}
