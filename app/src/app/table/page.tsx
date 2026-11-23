import { Suspense } from "react";
import { Floor } from "@/components/floor/floor";
import { FloorSkeleton } from "@/components/floor/states";

export default function TablePage() {
  return (
    <Suspense fallback={<FloorSkeleton />}>
      <Floor />
    </Suspense>
  );
}
