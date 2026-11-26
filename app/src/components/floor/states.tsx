"use client";

import { Activity, ArrowLeft, LockKeyhole, RotateCcw } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function FloorSkeleton() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1 px-6 py-8">
      <p role="status" className="text-muted mb-4 text-center text-sm font-extrabold">
        Connecting to the table…
      </p>
      <Skeleton className="h-20 w-full" />
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
        <Skeleton className="h-[420px]" />
        <Skeleton className="h-[420px]" />
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
      <span className="micro-label text-brand">Table offline</span>
      <h1 className="mt-3 text-3xl tracking-tight">The game table isn&apos;t running right now</h1>
      <p className="text-muted mt-3 max-w-md text-sm leading-6 font-semibold">
        Nothing is wrong on your side. Try again in a moment, or learn how to play while you wait.
        {privacy ? " The privacy check needs a live table and a guest key." : ""}
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          className={buttonStyles({ variant: "primary" })}
          onClick={() => window.location.reload()}
        >
          <RotateCcw aria-hidden className="size-4" /> Try again
        </button>
        <Link href="/rules" className={buttonStyles({ variant: "sun" })}>
          How to play
        </Link>
        <Link href="/" className={buttonStyles({ variant: "outline" })}>
          <ArrowLeft aria-hidden className="size-4" /> Back to home
        </Link>
      </div>
      <p className="text-faint mt-6 text-xs">
        For developers: the table authority is not configured, or its public accounts are not
        deployed.
      </p>
    </main>
  );
}
