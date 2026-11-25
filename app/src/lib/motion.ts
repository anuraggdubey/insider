export const snappy = { type: "spring", stiffness: 520, damping: 32 } as const;
export const bouncy = { type: "spring", stiffness: 380, damping: 18 } as const;
export const soft = { type: "spring", stiffness: 160, damping: 24 } as const;
export const spring = snappy;
export const reducedTransition = { duration: 0 } as const;
export const landingFlash = { duration: 0.7 } as const;
