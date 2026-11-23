import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { WatchView } from "@/components/watch/watch-view";

export default function WatchPage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <WatchView />
    </Suspense>
  );
}
