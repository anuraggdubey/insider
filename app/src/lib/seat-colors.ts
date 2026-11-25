/**
 * One capsule colour per seat, taken from the launch film. Your own capsule is always blue;
 * the seat that normally wears blue borrows your colour so no two seats ever match.
 */
export const YOU_COLOR = "#2f6bff";

export const SEAT_COLORS = [
  "#2fc073", // Quiet Heron
  "#ff4f96", // Bold Lynx
  "#ff6a35", // Silver Fox
  "#7448f5", // Swift Otter
  "#ffc52e", // Amber Wolf
  "#3a3a42", // Calm Raven
  "#25b8d1", // Hidden Tiger
  YOU_COLOR,
  "#f5404a",
  "#93d62a",
] as const;

const WHALE_COLOR = "#0d1633";
const LIGHT = new Set(["#ffc52e", "#93d62a", "#25b8d1", "#2fc073"]);

export function seatColor(index: number, mine?: number): string {
  if (index === mine) return YOU_COLOR;
  const base = SEAT_COLORS[index];
  if (!base) return WHALE_COLOR;
  if (base === YOU_COLOR && mine !== undefined) return SEAT_COLORS[mine] ?? base;
  return base;
}

/** Readable text colour on top of a seat colour. */
export function seatInk(color: string): string {
  return LIGHT.has(color) ? "#0d1633" : "#ffffff";
}
