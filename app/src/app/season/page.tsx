import { Suspense } from "react";
import { SeasonView } from "@/components/season/season-view";
import { GameProvider } from "@/app/game-provider";

export const metadata = {
  title: "Season — INSIDER",
  description: "Explore season standings, analyst statistics and this browser's X-ray archive.",
};

export default function SeasonPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto w-full max-w-7xl px-6 py-16">Loading season…</main>}
    >
      <GameProvider>
        <SeasonView />
      </GameProvider>
    </Suspense>
  );
}
