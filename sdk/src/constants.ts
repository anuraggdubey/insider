export const SEEDS = {
  board: "board",
  callBook: "callbook",
  callVault: "callvault",
  future: "future",
  leak: "leak",
  market: "market",
  mempool: "mempool",
  nobody: "nobody",
  season: "season",
  seat: "seat",
  table: "table",
  tape: "tape",
  xray: "xray",
} as const;
export const SEAT_COUNT = 10;
export const SLOTS_PER_TICK = 50;
export const TICK_MILLIS = 500;
export const LIVE_TICKS = 160;
export const CLOSING_END_TICK = 180;
export const ROUND_TICKS = 200;
export const PATH_LEN = 192;
export const LEAK_SLOTS = 6;
export const DROPS_PER_ROUND = 8;
export const PRICE_ONE = 1_000_000;
export const LANE_STANDARD = 0;
export const LANE_PRIORITY = 1;
export const WHALE_SEAT = 255;
export const NO_SEAT = 254;
export const BANKROLL_CHIPS = 1_000;
export const BANKROLL = BANKROLL_CHIPS;
export const E1_PRIORITY_FEE_CHIPS = 3;
export const MARKET_FLOOR = 0;
export const MARKET_DESK = 1;
