/**
 * Commentary: turns public events into short live captions for the broadcast view and the share
 * cards. It reads public accounts only (never the mempool, the future or a vault) and compares two
 * snapshots at a time, so event detection is pure and unit-tested.
 */
export type LeakSnap = {
  leakId: number;
  kind: number;
  rarity: number;
  /** 0 empty, 1 auction, 2 owned, 3 listed, 4 opened, 5 expired. */
  state: number;
  ownerSeat: number;
  paid: number;
  ask: number;
  licenseAsk: number;
  readerCount: number;
};

export type CallSnap = {
  callId: number;
  author: number;
  /** 0 empty, 1 open, 2 right, 3 wrong. */
  state: number;
  /** USD at mint. */
  mintedUsd: number;
  horizon: number;
  /** +1 up, -1 down, 0 still private. */
  revealedDir: number;
};

export type FillSnap = { n: number; seat: number; side: number; size: number; price: number };

export type Snapshot = {
  roundId: number;
  phase: string;
  /** Display names of the ten seats (an empty seat has none). */
  names: Array<string | undefined>;
  leaks: LeakSnap[];
  calls: CallSnap[];
  /** The newest fills, each with its running number. */
  fills: FillSnap[];
  xray: {
    roundId: number;
    finalized: boolean;
    tagCount: number;
    topSeat: number;
    topScore: number;
  };
};

export type CaptionEvent = {
  kind:
    | "round-start"
    | "round-end"
    | "leak-drop"
    | "leak-bought"
    | "leak-listed"
    | "leak-flipped"
    | "leak-opened"
    | "license-sold"
    | "call-minted"
    | "call-judged"
    | "big-fill"
    | "sandwich";
  text: string;
};

const KINDS = ["Flow", "Spotlight", "Whale", "Full Book", "Pin", "Drift", "Shockwave", "Summit"];
const RARITIES = ["common", "rare", "epic"];
/** A fill this large (in units) makes the news. */
export const BIG_FILL_UNITS = 250;

const seatName = (snapshot: Snapshot, seat: number) =>
  seat >= 0 && seat < snapshot.names.length
    ? (snapshot.names[seat] ?? `Seat ${seat + 1}`)
    : "The house";
const kindName = (leak: LeakSnap) =>
  `${RARITIES[leak.rarity] ?? "common"} ${KINDS[leak.kind] ?? "Leak"}`;

/** What happened between two looks at the table. */
export function diffEvents(prev: Snapshot | undefined, next: Snapshot): CaptionEvent[] {
  if (!prev) return [];
  const events: CaptionEvent[] = [];
  const say = (kind: CaptionEvent["kind"], text: string) => events.push({ kind, text });

  if (next.roundId !== prev.roundId && next.phase === "live") {
    say("round-start", `Round ${next.roundId} is live. The dark mempool is open.`);
  }
  if (next.xray.finalized && (!prev.xray.finalized || next.xray.roundId !== prev.xray.roundId)) {
    const lead =
      next.xray.topScore > 0
        ? ` ${seatName(next, next.xray.topSeat)} led the round with +${next.xray.topScore}.`
        : "";
    say("round-end", `Round ${next.xray.roundId} is scored.${lead}`);
    if (next.xray.tagCount > 0) {
      say(
        "sandwich",
        next.xray.tagCount === 1
          ? "The X-ray caught a sandwich: someone read a Leak and got in front."
          : `The X-ray caught ${next.xray.tagCount} sandwiches in round ${next.xray.roundId}.`,
      );
    }
  }

  next.leaks.forEach((leak, slot) => {
    const before = prev.leaks[slot];
    if (next.roundId !== prev.roundId) {
      // a new round resets the board: only the drops are news
      if (leak.state === 1) say("leak-drop", `A ${kindName(leak)} Leak is up for auction.`);
      return;
    }
    if (!before || before.leakId === leak.leakId) {
      if (!before) return;
      if (before.state !== leak.state) {
        if ((before.state === 1 && leak.state === 2) || (before.state === 3 && leak.state === 2)) {
          const flipped = before.state === 3;
          say(
            flipped ? "leak-flipped" : "leak-bought",
            flipped
              ? `${seatName(next, leak.ownerSeat)} bought a sealed ${kindName(leak)} Leak from the flip market.`
              : `${seatName(next, leak.ownerSeat)} won the ${kindName(leak)} Leak for ${leak.paid} chips. Sealed.`,
          );
        } else if (leak.state === 3) {
          say(
            "leak-listed",
            `${seatName(next, leak.ownerSeat)} is selling a sealed ${kindName(leak)} Leak for ${leak.ask}.`,
          );
        } else if (leak.state === 4) {
          say(
            "leak-opened",
            `${seatName(next, leak.ownerSeat)} cracked open the ${kindName(leak)} Leak. Only they can read it.`,
          );
        }
      } else if (leak.state === 4 && leak.readerCount > before.readerCount) {
        say(
          "license-sold",
          `A licence for ${seatName(next, leak.ownerSeat)}'s ${kindName(leak)} Leak just sold (${leak.readerCount} readers).`,
        );
      }
    } else if (leak.state === 1) {
      say("leak-drop", `A ${kindName(leak)} Leak is up for auction.`);
    }
  });

  next.calls.forEach((call) => {
    const before = prev.calls.find((c) => c.author === call.author);
    if (call.state === 1 && (!before || before.callId !== call.callId)) {
      say(
        "call-minted",
        `${seatName(next, call.author)} committed a ${call.horizon}s Call on SOL at $${call.mintedUsd.toFixed(2)}. Direction sealed.`,
      );
    } else if (
      (call.state === 2 || call.state === 3) &&
      before?.state === 1 &&
      before.callId === call.callId
    ) {
      const dir = call.revealedDir > 0 ? "up" : "down";
      say(
        "call-judged",
        call.state === 2
          ? `${seatName(next, call.author)} called it: SOL ${dir}. The oracle agrees.`
          : `${seatName(next, call.author)} called SOL ${dir} and the oracle disagrees.`,
      );
    }
  });

  const lastSeen = prev.fills.at(-1)?.n ?? -1;
  for (const fill of next.fills.filter((f) => f.n > lastSeen && f.size >= BIG_FILL_UNITS)) {
    say(
      "big-fill",
      `${seatName(next, fill.seat)} ${fill.side > 0 ? "bought" : "sold"} ${fill.size} units at ${fill.price.toFixed(4)}.`,
    );
  }
  return events;
}

/** A bounded list of captions with running ids, for the HTTP feed. */
export class CaptionFeed {
  private readonly items: Array<{ id: number; at: number; kind: string; text: string }> = [];
  private nextId = 1;

  constructor(private readonly capacity = 100) {}

  add(kind: string, text: string, at = Date.now()) {
    this.items.push({ id: this.nextId++, at, kind, text });
    while (this.items.length > this.capacity) this.items.shift();
  }

  since(id = 0) {
    return this.items.filter((item) => item.id > id);
  }
}

/**
 * Optional wording pass by a model. Each batch is rewritten in one call; if the model cannot be
 * reached the batch stays queued and nothing is published (captions pause) until it can.
 */
export type Rewriter = (texts: string[]) => Promise<string[]>;

export class Commentator {
  private queue: CaptionEvent[] = [];
  private paused = false;

  constructor(
    private readonly feed: CaptionFeed,
    private readonly rewrite?: Rewriter,
    private readonly maxQueue = 30,
  ) {}

  get isPaused() {
    return this.paused;
  }

  async push(events: CaptionEvent[]) {
    this.queue.push(...events);
    if (this.queue.length > this.maxQueue) this.queue = this.queue.slice(-this.maxQueue);
    await this.flush();
  }

  async flush() {
    if (this.queue.length === 0) return;
    let texts = this.queue.map((event) => event.text);
    if (this.rewrite) {
      try {
        const out = await this.rewrite(texts);
        if (out.length === texts.length) texts = out;
        this.paused = false;
      } catch {
        this.paused = true;
        return;
      }
    }
    this.queue.forEach((event, i) => this.feed.add(event.kind, texts[i]!));
    this.queue = [];
  }
}
