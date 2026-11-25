import { useId, type ReactNode } from "react";
export function Tooltip({ children, content }: { children: ReactNode; content: string }) {
  const id = useId();
  return (
    <span className="group/tooltip relative inline-flex" tabIndex={0} aria-describedby={id}>
      {children}
      <span
        id={id}
        role="tooltip"
        className="border-line-strong bg-surface-2 text-text pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-56 -translate-x-1/2 rounded-md border px-3 py-2 text-xs opacity-0 transition-opacity group-hover/tooltip:opacity-100 group-focus/tooltip:opacity-100"
      >
        {content}
      </span>
    </span>
  );
}
