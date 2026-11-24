import { Suspense } from "react";
import { CupView } from "@/components/cup/cup-view";
import { GameProvider } from "@/app/game-provider";

export const metadata = {
  title: "Alpha Cup — INSIDER",
  description: "Five rounds, human seats only, private buy-ins and private prize payouts.",
};

export default function CupPage() {
  return (
    <Suspense
      fallback={<main className="mx-auto w-full max-w-7xl px-6 py-16">Loading the cup…</main>}
    >
      <GameProvider>
        <CupView />
      </GameProvider>
    </Suspense>
  );
}
