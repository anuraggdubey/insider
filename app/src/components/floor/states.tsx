import { Activity, ArrowLeft, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FloorSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8">
      <Skeleton className="h-20 w-full" />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)_290px]">
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-[480px]" />
        <Skeleton className="h-[480px]" />
      </div>
      <Skeleton className="mt-4 h-48" />
    </main>
  );
}

export function TableOffline({ privacy = false }: { privacy?: boolean }) {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="border-line-strong bg-surface-2 text-muted mb-6 flex size-14 items-center justify-center rounded-full border">
        {privacy ? <LockKeyhole className="size-5" /> : <Activity className="size-5" />}
      </div>
      <span className="micro-label text-sealed">Solana devnet / Private ER</span>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Table offline</h1>
      <p className="text-muted mt-3 max-w-md text-sm leading-6">
        The table authority is not configured or its public accounts have not been deployed yet.
        {privacy
          ? " The privacy check needs a live table and a guest key."
          : " No live market data is available."}
      </p>
      <Link href="/" className={buttonStyles({ variant: "outline", className: "mt-7" })}>
        <ArrowLeft className="size-4" /> Back to home
      </Link>
    </main>
  );
}
