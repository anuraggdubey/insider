import { Suspense } from "react";
import { DeskView } from "@/components/desk/desk-view";
import { GameProvider } from "@/app/game-provider";
import { PageTransition } from "@/components/ui/page-transition";

export const metadata = {
  title: "The Desk — INSIDER",
  description:
    "Call SOL up or down, keep the direction sealed, sell licences to read it, and get judged by the oracle.",
};

export default function DeskPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={<main className="mx-auto w-full max-w-7xl px-6 py-16">Loading the Desk…</main>}
      >
        <GameProvider>
          <DeskView />
        </GameProvider>
      </Suspense>
    </PageTransition>
  );
}
