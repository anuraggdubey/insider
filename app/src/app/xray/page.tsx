import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { XrayView } from "@/components/xray/xray-view";

export const metadata = {
  title: "X-ray — INSIDER",
  description: "Replay the public record of orders, Leaks and sandwiches after the round.",
};

export default function XrayPage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <XrayView />
    </Suspense>
  );
}
