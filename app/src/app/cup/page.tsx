import { Suspense } from "react";
import { CupEntry } from "@/components/cup/cup-entry";
import { PageTransition } from "@/components/ui/page-transition";

export const metadata = {
  title: "Alpha Cup — INSIDER",
  description: "Five rounds, human seats only, private buy-ins and private prize payouts.",
};

export default function CupPage() {
  return (
    <PageTransition>
      <Suspense
        fallback={<main className="mx-auto w-full max-w-7xl px-6 py-16">Loading the cup…</main>}
      >
        <CupEntry />
      </Suspense>
    </PageTransition>
  );
}
