import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { CapsuleArt } from "@/components/ui/capsule-art";
import { cn } from "@/lib/cn";

const colors = ["#2f6bff", "#ffc52e", "#2fc073"];

export type GuideStep = { title: string; text: string };

/** "What is this page and what do I do here?" in three numbered steps. */
export function PageGuide({
  title,
  steps,
  action,
  className,
}: {
  title: string;
  steps: GuideStep[];
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <section aria-label={title} className={cn("gcard p-4 sm:p-5", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg">{title}</h2>
        {action && (
          <Link
            href={action.href}
            prefetch={false}
            className={buttonStyles({ variant: "sun", size: "sm" })}
          >
            {action.label} <ArrowRight aria-hidden className="size-4" />
          </Link>
        )}
      </div>
      <ol className="mt-3 grid gap-3 md:grid-cols-3">
        {steps.map((step, index) => (
          <li key={step.title} className="bg-surface-2 flex gap-3 rounded-2xl p-3">
            <span className="relative shrink-0">
              <CapsuleArt size={40} color={colors[index % colors.length]!} />
              <span className="sr-only">Step {index + 1}: </span>
            </span>
            <span className="min-w-0">
              <strong className="block text-sm font-black">
                <span aria-hidden>{index + 1}. </span>
                {step.title}
              </strong>
              <span className="text-muted mt-0.5 block text-[13px] leading-5 font-semibold">
                {step.text}
              </span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}
