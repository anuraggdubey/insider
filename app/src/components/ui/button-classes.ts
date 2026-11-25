export type Variant = "primary" | "ink" | "ghost" | "outline" | "buy" | "sell" | "priority";
export type Size = "sm" | "md" | "lg";

export const buttonBase = "btn relative disabled:pointer-events-none";
export const buttonVariants: Record<Variant, string> = {
  primary: "",
  ink: "btn-ink",
  ghost: "btn-ghost",
  outline: "btn-outline",
  buy: "btn-buy",
  sell: "btn-sell",
  priority: "btn-priority",
};
export const buttonSizes: Record<Size, string> = {
  sm: "btn-sm h-9 px-3.5 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};
export function basicButtonStyles(variant: Variant, size: Size) {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}
