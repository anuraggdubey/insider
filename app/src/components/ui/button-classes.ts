export type Variant = "primary" | "ghost" | "outline" | "buy" | "sell" | "priority";
export type Size = "sm" | "md" | "lg";

export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sealed disabled:pointer-events-none disabled:opacity-50";
export const buttonVariants: Record<Variant, string> = {
  primary: "bg-sealed text-bg shadow-[0_0_24px_rgba(90,180,255,.18)] hover:bg-[#8bcbff]",
  ghost: "text-muted hover:bg-surface-2 hover:text-text",
  outline: "border border-line-strong bg-transparent text-text hover:border-muted",
  buy: "bg-buy text-bg hover:brightness-110",
  sell: "bg-sell text-bg hover:brightness-110",
  priority: "bg-priority text-bg hover:brightness-110",
};
export const buttonSizes: Record<Size, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-sm",
};
export function basicButtonStyles(variant: Variant, size: Size) {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}
