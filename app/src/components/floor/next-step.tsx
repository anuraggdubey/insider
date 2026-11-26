"use client";

import type { InsiderConfig, TableView } from "@insider/sdk";
import { ArrowRight, Check, CircleHelp, Compass } from "lucide-react";
import Link from "next/link";
import { useJoin } from "@/components/onboarding/use-join";
import { Button, buttonStyles } from "@/components/ui/button";
import { CapsuleArt } from "@/components/ui/capsule-art";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/cn";
import { setFloorView, type FloorView } from "@/lib/floor-prefs";
import { nextStep } from "@/lib/onboarding";
import { YOU_COLOR } from "@/lib/seat-colors";

const stages = ["Join", "Trade", "Capsules", "Results"];
const stageColor = [YOU_COLOR, "#2fc073", "#ffc52e", "#7448f5"] as const;

/**
 * "What do I do now?" in one sentence with one button. It reads the table view and never
 * changes the round on its own.
 */
export function NextStepBar({
  config,
  view,
  result,
  wallet,
  seatOpen,
  xrayHref,
  floorView,
  onGo,
  onGuide,
  onTour,
}: {
  config: InsiderConfig;
  view: TableView;
  result?: number;
  wallet: boolean;
  seatOpen: boolean;
  xrayHref: string;
  floorView: FloorView;
  onGo: (target: "trade" | "capsules") => void;
  onGuide: () => void;
  onTour: () => void;
}) {
  const step = nextStep({ ...view, result, wallet, seatOpen });
  const { joining, seat, joinAsGuest } = useJoin(config);
  const action = step.action;
  return (
    <>
      {/* Only this card sticks while scrolling; the controls under it scroll away. */}
      <section
        aria-label="Your next move"
        data-testid="next-step"
        data-step={step.id}
        data-tour="next"
        className="floor-next gcard z-20 mb-2 flex shrink-0 flex-wrap items-center gap-x-4 gap-y-3 p-3 md:sticky md:top-[3.75rem] md:px-4 md:py-2.5"
      >
        <span className="hidden shrink-0 sm:block">
          <CapsuleArt size={46} color={stageColor[step.stage]} mark={step.stage === 2} />
        </span>
        <div className="min-w-[15rem] flex-1" aria-live="polite" aria-atomic="true">
          <p className="micro-label text-brand">Your next move</p>
          <h2 className="text-lg leading-tight sm:text-xl">{step.title}</h2>
          <p className="text-muted mt-0.5 text-[13px] leading-5 font-semibold">{step.detail}</p>
        </div>
        {action &&
          (action.target === "join" ? (
            <Button
              variant="sun"
              size="lg"
              onClick={() => void (wallet ? seat() : joinAsGuest())}
              loading={joining}
            >
              {action.label} <ArrowRight aria-hidden className="size-4" />
            </Button>
          ) : action.target === "xray" ? (
            <Link
              href={xrayHref}
              prefetch={false}
              className={buttonStyles({ variant: "sun", size: "lg" })}
            >
              {action.label} <ArrowRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <Button variant="sun" onClick={() => onGo(action.target as "trade" | "capsules")}>
              {action.label} <ArrowRight aria-hidden className="size-4" />
            </Button>
          ))}
      </section>
      <div className="floor-next-tools mb-3 flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 px-1">
        <ol aria-label="Round steps" className="hidden items-center gap-1.5 sm:flex">
          {stages.map((stage, index) => {
            const state =
              index === step.stage ? "current" : index < step.stage ? "done" : "upcoming";
            return (
              <li
                key={stage}
                data-state={state}
                aria-current={state === "current" ? "step" : undefined}
                className="coach-step border-line bg-surface-2 text-muted flex items-center gap-1 rounded-full border py-0.5 pr-2.5 pl-1 text-[11px] font-extrabold"
              >
                <span className="bg-surface text-ink grid size-4 place-items-center rounded-full text-[9px]">
                  {state === "done" ? <Check aria-hidden className="size-2.5" /> : index + 1}
                </span>
                {stage}
              </li>
            );
          })}
        </ol>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:ml-auto">
          <button
            type="button"
            onClick={onGuide}
            className="text-brand flex min-h-8 cursor-pointer items-center gap-1 text-xs font-extrabold"
          >
            <CircleHelp aria-hidden className="size-4" /> How to play
          </button>
          <button
            type="button"
            onClick={onTour}
            className="text-brand flex min-h-8 cursor-pointer items-center gap-1 text-xs font-extrabold"
          >
            <Compass aria-hidden className="size-4" /> Show me around
          </button>
          <span data-tour="view" className={cn("inline-flex")}>
            <Switch
              label="Show all panels"
              checked={floorView === "full"}
              onCheckedChange={(full) => setFloorView(full ? "full" : "simple")}
              off="Simple"
              on="All panels"
              className="min-h-8"
            />
          </span>
        </div>
      </div>
    </>
  );
}
