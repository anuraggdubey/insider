import { describe, expect, it } from "vitest";
import {
  LEAK_PLAIN,
  leakPlain,
  nextStep,
  ordinal,
  seatAvailable,
  seconds,
  signed,
  type GuideView,
} from "../../app/src/lib/onboarding";
import { createFixture, fixtureClaim } from "../../app/src/lib/fixture";
import { joinFloor } from "../../app/src/lib/floor-actions";
import { updateFloor, useFloorStore } from "../../app/src/lib/floor-store";
import { createConfig, deriveTable } from "../src/index";
import { Keypair } from "@solana/web3.js";

const seat = { position: 0, pnl: 0, chips: 1_000, liquidated: false };
const leak = {
  kindName: "Pin",
  isMine: false,
  canOpen: false,
  canBid: false,
  currentPrice: 8,
  isReader: false,
  state: 1,
  windowEnd: 40,
};
const view = (over: Partial<GuideView> = {}): GuideView => ({
  phase: "live",
  tick: 20,
  secondsLeft: 70,
  mine: seat,
  myPending: [],
  leaks: [],
  ...over,
});

describe("next move", () => {
  it("asks a spectator to join in every playable phase", () => {
    for (const phase of ["live", "closing", "idle", "seeding"])
      expect(nextStep(view({ phase, mine: undefined })).id).toBe("join");
  });

  it("offers a connected wallet its own seat", () => {
    const step = nextStep(view({ mine: undefined, wallet: true }));
    expect(step.action?.label).toBe("Take a seat");
    expect(step.detail).toContain("Your wallet is connected.");
    expect(nextStep(view({ mine: undefined })).action?.label).toBe("Play as guest");
  });

  it("never advertises a capsule whose window has closed", () => {
    const mine = { ...seat, position: 250, chips: 740 };
    const stale = { ...leak, canBid: true, windowEnd: 19 };
    expect(nextStep(view({ mine, leaks: [stale] })).id).toBe("holding");
  });

  it("shows the result from the final score, not the reset seat", () => {
    const step = nextStep(view({ phase: "xray", result: -20 }));
    expect(step.title).toBe("Round over. You scored -20 chips");
    expect(step.action?.target).toBe("xray");
    expect(nextStep(view({ phase: "xray" })).title).toBe("Round over");
    expect(nextStep(view({ phase: "xray", mine: undefined })).id).toBe("results");
  });

  it("covers waiting, being out and the closing window", () => {
    expect(nextStep(view({ phase: "idle" })).id).toBe("between");
    expect(nextStep(view({ mine: { ...seat, liquidated: true } })).id).toBe("out");
    expect(nextStep(view({ phase: "closing", secondsLeft: 4.2 })).detail).toContain("in 5s");
  });

  it("puts an unread capsule ahead of everything else", () => {
    const step = nextStep(
      view({
        myPending: [{ sideSize: 100, ticksToLand: 4 }],
        leaks: [{ ...leak, isMine: true, canOpen: true, state: 2 }],
      }),
    );
    expect(step.id).toBe("open-capsule");
  });

  it("tracks an order on its way", () => {
    const step = nextStep(view({ myPending: [{ sideSize: -500, ticksToLand: 3 }] }));
    expect(step.id).toBe("order-pending");
    expect(step.title).toContain("1.5s");
    expect(step.detail).toContain("SELL 500");
  });

  it("uses an opened secret only while it is still good", () => {
    const secret = { ...leak, isMine: true, isReader: true, state: 4 };
    expect(nextStep(view({ leaks: [secret] })).id).toBe("use-secret");
    expect(nextStep(view({ tick: 41, leaks: [secret] })).id).toBe("first-order");
  });

  it("leads from the first trade to capsules to holding", () => {
    expect(nextStep(view()).id).toBe("first-order");
    const traded = { ...seat, position: 250, chips: 740, pnl: 6 };
    expect(nextStep(view({ mine: traded, leaks: [{ ...leak, canBid: true }] })).id).toBe(
      "buy-capsule",
    );
    const holding = nextStep(view({ mine: traded }));
    expect(holding.id).toBe("holding");
    expect(holding.title).toBe("You're betting the price goes up. Score now +6");
    expect(nextStep(view({ mine: { ...traded, position: -250 } })).detail).toContain("buy");
    expect(nextStep(view({ mine: { ...seat, chips: 990, pnl: -10 } })).id).toBe("watch");
  });

  it("works on a real simulated table", () => {
    const table = deriveTable(createFixture().snapshot);
    expect(nextStep(table).id).toBe("join");
  });
});

describe("open seats", () => {
  // The guide must agree with what joining really does.
  async function joins(fixture: ReturnType<typeof createFixture>) {
    const guest = Keypair.generate();
    updateFloor({ fixture, snapshot: fixture.snapshot, identity: "guest", guest });
    try {
      await joinFloor(createConfig());
    } catch {
      return false;
    }
    return useFloorStore.getState().snapshot!.seats.some((s) => s.owner.equals(guest.publicKey));
  }
  const fillHumans = (fixture: ReturnType<typeof createFixture>) => {
    for (const index of [7, 8, 9]) fixtureClaim(fixture, Keypair.generate().publicKey, index);
  };

  it("is open while a human seat is free", async () => {
    const fixture = createFixture();
    expect(seatAvailable(fixture.snapshot)).toBe(true);
    expect(await joins(fixture)).toBe(true);
  });

  it("is full when people hold their seats and the bots are active", async () => {
    const fixture = createFixture();
    fillHumans(fixture);
    expect(seatAvailable(fixture.snapshot)).toBe(false);
    expect(await joins(fixture)).toBe(false);
    const step = nextStep(view({ mine: undefined, seatOpen: false }));
    expect(step.id).toBe("full");
    expect(step.action).toBeUndefined();
  });

  it("frees a human seat left behind in an earlier round", async () => {
    const fixture = createFixture();
    fillHumans(fixture);
    fixture.snapshot.seats[8]!.lastSeenTick = 150;
    expect(seatAvailable(fixture.snapshot)).toBe(true);
    expect(await joins(fixture)).toBe(true);
  });

  it("opens again when a flat bot goes idle", async () => {
    const fixture = createFixture();
    fillHumans(fixture);
    fixture.snapshot.table.tick = 60;
    // The people at the table are still active.
    for (const index of [7, 8, 9]) fixture.snapshot.seats[index]!.lastSeenTick = 60;
    expect(seatAvailable(fixture.snapshot)).toBe(false);
    fixture.snapshot.seats[0]!.position = 0;
    expect(seatAvailable(fixture.snapshot)).toBe(true);
    expect(await joins(fixture)).toBe(true);
  });
});

describe("plain wording", () => {
  it("explains every kind of secret", () => {
    const fixture = createFixture().snapshot;
    for (let kind = 0; kind < 8; kind++) {
      fixture.board.headers[0]!.kind = kind;
      expect(deriveTable(fixture).leaks[0]!.kindName).not.toBe("Unknown");
      expect(leakPlain(kind)).toBe(LEAK_PLAIN[kind]);
    }
    expect(LEAK_PLAIN).toHaveLength(8);
  });

  it("formats places, scores and countdowns", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
    ]);
    expect([signed(5), signed(0), signed(-1500)]).toEqual(["+5", "0", "-1,500"]);
    expect([seconds(3), seconds(-2)]).toEqual(["1.5s", "0.0s"]);
  });
});
