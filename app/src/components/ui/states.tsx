import type { ReactNode } from "react";

export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="text-muted flex flex-wrap items-center justify-between gap-3 p-5 text-sm">
      <p>{children}</p>
      {action}
    </div>
  );
}
export function ErrorState({ children, retry }: { children: ReactNode; retry: ReactNode }) {
  return (
    <div
      role="alert"
      className="border-sell text-text flex flex-wrap items-center justify-between gap-3 rounded-lg border p-5 text-sm"
    >
      <p>{children}</p>
      {retry}
    </div>
  );
}
