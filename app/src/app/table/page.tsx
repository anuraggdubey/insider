import { Suspense } from "react";
import { TableEntry } from "@/components/floor/table-entry";
import { FloorSkeleton } from "@/components/floor/states";
import { PageTransition } from "@/components/ui/page-transition";

export const metadata = {
  title: "The floor — INSIDER",
  description: "Trade the market, buy Leaks and jump the line on the INSIDER floor.",
};

export default function TablePage() {
  return (
    <PageTransition>
      <Suspense fallback={<FloorSkeleton />}>
        <TableEntry />
      </Suspense>
    </PageTransition>
  );
}
