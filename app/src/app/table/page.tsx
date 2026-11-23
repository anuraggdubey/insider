import { Suspense } from "react";
import { Floor } from "@/components/floor/floor";
import { FloorSkeleton } from "@/components/floor/states";

export const metadata = {
  title: "The floor — INSIDER",
  description: "Trade the market, buy Leaks and jump the line on the INSIDER floor.",
};

export default function TablePage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <Floor />
    </Suspense>
  );
}
