import { Suspense } from "react";
import { FloorSkeleton } from "@/components/floor/states";
import { XrayView } from "@/components/xray/xray-view";

export default function XrayPage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <XrayView />
    </Suspense>
  );
}
