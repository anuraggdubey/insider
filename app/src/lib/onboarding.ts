/**
 * Plain-language help for new players. Everything here only reads the table view and turns it
 * into words; nothing changes the round.
 */
import { BANKROLL_CHIPS, TICK_MILLIS } from "@insider/sdk/constants";
import type { TableSnapshot } from "@insider/sdk";
import { pickSeat } from "./pick-seat";

/** What each secret tells you, by Leak kind (the order matches the program's `LeakKind`). */
export const LEAK_PLAIN = [
  "Whether the orders landing in a coming time window add up to more buying or more selling.",
  "The biggest order waiting to land (whale orders not counted).",
  "The next giant “whale” order due in the next 30 seconds.",
  "The waiting orders, listed in the order they will land (up to 32).",
  "Where the market's hidden fair price will be at one future moment. The live price is pulled toward it.",
  "Whether the hidden fair price is about to move up or down, and roughly how much.",
  "Whether a sudden price jump is coming, when, and which way.",
  "When the hidden fair price will be at its highest and lowest.",
] as const;

export function leakPlain(kind: number) {
  return LEAK_PLAIN[kind] ?? "A private clue about this round.";
}

export function signed(value: number) {
  return `${value > 0 ? "+" : ""}${value.toLocaleString("en-US")}`;
}

export function ordinal(value: number) {
  const tens = value % 100;
  if (tens >= 11 && tens <= 13) return `${value}th`;
  return `${value}${["th", "st", "nd", "rd"][value % 10] ?? "th"}`;
}

export function seconds(ticks: number) {
  return `${((Math.max(0, ticks) * TICK_MILLIS) / 1000).toFixed(1)}s`;
}

/** Whether a new player could get a seat right now, by the same rule joining uses. */
export function seatAvailable(snapshot: Pick<TableSnapshot, "seats" | "table">) {
  return pickSeat(snapshot) !== null;
}

export type GuideView = {
  phase: string;
  tick: number;
  /** True when a wallet is connected and selected as the player. */
  wallet?: boolean;
  /** False when every seat a newcomer could take is occupied. */
  seatOpen?: boolean;
  secondsLeft: number;
  mine?: { position: number; pnl: number; chips: number; liquidated: boolean };
  myPending: { sideSize: number; ticksToLand: number }[];
  /**
   * Your final score once the round is scored. The seat's chips reset at that moment, so the
   * live `pnl` can't be used on the results screen.
   */
  result?: number;
  leaks: {
    kindName: string;
    isMine: boolean;
    canOpen: boolean;
    canBid: boolean;
    currentPrice: number;
    isReader: boolean;
    state: number;
    windowEnd: number;
  }[];
};

export type NextStep = {
  id:
    | "join"
    | "full"
    | "between"
    | "results"
    | "out"
    | "closing"
    | "open-capsule"
    | "order-pending"
    | "use-secret"
    | "first-order"
    | "buy-capsule"
    | "holding"
    | "watch";
  /** Which of the four stages is current: join, trade, capsules, results. */
  stage: 0 | 1 | 2 | 3;
  title: string;
  detail: string;
  action?: { label: string; target: "join" | "trade" | "capsules" | "xray" };
};

/** The single most useful thing for this player to do right now. */
export function nextStep(view: GuideView): NextStep {
  const { mine, phase } = view;
  const left = Math.ceil(view.secondsLeft);

  if (phase === "xray")
    return {
      id: "results",
      stage: 3,
      title:
        view.result === undefined
          ? "Round over"
          : `Round over. You scored ${signed(view.result)} chips`,
      detail: "Open the replay to see every hidden order and secret from this round.",
      action: { label: "See the replay", target: "xray" },
    };
  if (!mine && view.seatOpen === false)
    return {
      id: "full",
      stage: 0,
      title: "Every seat is busy right now",
      detail:
        "Watch and learn for now. A seat frees up when a player goes quiet, and the join button returns.",
    };
  if (!mine)
    return {
      id: "join",
      stage: 0,
      title: "Join the game to start playing",
      detail:
        phase === "live"
          ? `${view.wallet ? "Your wallet is connected." : "Free, no wallet needed."} You get ${BANKROLL_CHIPS.toLocaleString("en-US")} play chips and can trade right away.`
          : `${view.wallet ? "Your wallet is connected." : "Free, no wallet needed."} Take a seat now and you're ready for the next round.`,
      action: { label: view.wallet ? "Take a seat" : "Play as guest", target: "join" },
    };
  if (phase !== "live" && phase !== "closing")
    return {
      id: "between",
      stage: 1,
      title: "You're in. The next round starts shortly",
      detail: "Nothing to do yet. Trading opens as soon as the round begins.",
      action: { label: "Last round's replay", target: "xray" },
    };
  if (mine.liquidated)
    return {
      id: "out",
      stage: 1,
      title: "You're out for this round",
      detail: "Your chips ran out. You start fresh with new chips next round, so watch and learn.",
    };
  if (phase === "closing")
    return {
      id: "closing",
      stage: 3,
      title: "Trading is closed. Counting the score",
      detail: `The last orders are landing. Every position closes in ${left}s and your score is set.`,
    };

  const unopened = view.leaks.find((leak) => leak.isMine && leak.canOpen);
  if (unopened)
    return {
      id: "open-capsule",
      stage: 2,
      title: `Open your ${unopened.kindName} capsule`,
      detail: "You own a secret nobody has read. Open it before it expires.",
      action: { label: "Show my capsule", target: "capsules" },
    };
  const order = view.myPending[0];
  if (order)
    return {
      id: "order-pending",
      stage: 1,
      title: `Order on its way: lands in ${seconds(order.ticksToLand)}`,
      detail: `Your ${order.sideSize > 0 ? "BUY" : "SELL"} ${Math.abs(order.sideSize)} is sealed. Others see that you sent something, not what.`,
    };
  // State 4 is an opened Leak; it is only worth acting on until its window closes.
  const secret = view.leaks.find(
    (leak) => leak.isReader && leak.state === 4 && view.tick <= leak.windowEnd,
  );
  if (secret)
    return {
      id: "use-secret",
      stage: 2,
      title: `Use your ${secret.kindName} secret`,
      detail: "You know something others may not. Read the clue on your capsule, then trade.",
      action: { label: "Go to trade", target: "trade" },
    };
  if (mine.position === 0 && mine.chips === BANKROLL_CHIPS)
    return {
      id: "first-order",
      stage: 1,
      title: "Make your first trade of the round",
      detail: "Think the price will go up? Press BUY. Down? Press SELL. Then press Send.",
      action: { label: "Show me where", target: "trade" },
    };
  const forSale = view.leaks.find((leak) => leak.canBid && view.tick <= leak.windowEnd);
  if (forSale)
    return {
      id: "buy-capsule",
      stage: 2,
      title: `A secret is for sale: ${forSale.kindName}, ${forSale.currentPrice} chips`,
      detail: "Buy it to get a private clue. The price is falling, but someone else may grab it.",
      action: { label: "Show capsule", target: "capsules" },
    };
  if (mine.position !== 0) {
    const up = mine.position > 0;
    return {
      id: "holding",
      stage: 1,
      title: `You're betting the price goes ${up ? "up" : "down"}. Score now ${signed(mine.pnl)}`,
      detail: `To close the bet, ${up ? "sell" : "buy"} the same amount. Or hold until the round ends.`,
      action: { label: "Go to trade", target: "trade" },
    };
  }
  return {
    id: "watch",
    stage: 1,
    title: "Watch the price, then make your move",
    detail: `${left}s of trading left. Buy if you expect it to rise, sell if you expect it to fall.`,
    action: { label: "Go to trade", target: "trade" },
  };
}
