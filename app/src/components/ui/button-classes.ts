export type Variant = "primary" | "ghost" | "outline" | "buy" | "sell" | "priority";
export type Size = "sm" | "md" | "lg";

// Toy-box buttons: a thick ink outline, a flat drop shadow, and a springy press.
export const buttonBase =
  "inline-flex items-center justify-center gap-2 rounded-2xl border-[3px] border-ink font-[family-name:var(--font-lilita)] tracking-wide shadow-[0_4px_0_var(--color-ink)] transition-[transform,box-shadow,background-color] duration-150 ease-[cubic-bezier(.34,1.56,.64,1)] hover:-translate-y-0.5 hover:shadow-[0_6px_0_var(--color-ink)] active:translate-y-[3px] active:shadow-[0_1px_0_var(--color-ink)] focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-pop disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none";
export const buttonVariants: Record<Variant, string> = {
  primary: "bg-sun text-ink hover:bg-[#ffd24d]",
  ghost: "border-transparent shadow-none text-muted hover:bg-surface-2 hover:text-ink",
  outline: "bg-white text-ink hover:bg-surface-2",
  buy: "bg-buy text-white hover:brightness-110",
  sell: "bg-sell text-white hover:brightness-110",
  priority: "bg-priority text-white hover:brightness-110",
};
export const buttonSizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};
export function basicButtonStyles(variant: Variant, size: Size) {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}
