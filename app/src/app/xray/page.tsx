import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { XrayView } from "@/components/xray/xray-view";
import { GameProvider } from "@/app/game-provider";

export const metadata = {
  title: "X-ray — INSIDER",
  description: "Replay the public record of orders, Leaks and sandwiches after the round.",
};

export default function XrayPage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <GameProvider>
        <XrayView />
      </GameProvider>
    </Suspense>
  );
}
