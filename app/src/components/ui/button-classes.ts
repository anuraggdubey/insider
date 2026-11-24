export type Variant = "primary" | "ghost" | "outline" | "buy" | "sell" | "priority";
export type Size = "sm" | "md" | "lg";

// Game buttons: gradient face, darker lower edge, soft glow, springy press (see .btn in globals.css).
export const buttonBase =
  "btn focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-brand/60 disabled:pointer-events-none disabled:opacity-50";
export const buttonVariants: Record<Variant, string> = {
  primary: "",
  ghost: "btn-ghost",
  outline: "btn-outline",
  buy: "btn-buy",
  sell: "btn-sell",
  priority: "btn-priority",
};
export const buttonSizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-14 px-7 text-lg",
};
export function basicButtonStyles(variant: Variant, size: Size) {
  return `${buttonBase} ${buttonVariants[variant]} ${buttonSizes[size]}`;
}
