import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { WatchView } from "@/components/watch/watch-view";
import { GameProvider } from "@/app/game-provider";
import { PageTransition } from "@/components/ui/page-transition";

export const metadata = {
  title: "Watch — INSIDER",
  description: "Watch the public INSIDER market, leaderboard and commentary.",
};

export default function WatchPage() {
  return (
    <PageTransition>
      <Suspense fallback={<FloorSkeleton />}>
        <GameProvider>
          <WatchView />
        </GameProvider>
      </Suspense>
    </PageTransition>
  );
}
