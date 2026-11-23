import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { WatchView } from "@/components/watch/watch-view";

export const metadata = {
  title: "Watch — INSIDER",
  description: "Watch the public INSIDER market, leaderboard and commentary.",
};

export default function WatchPage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <WatchView />
    </Suspense>
  );
}
