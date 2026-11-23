"use client";

import { BN } from "@anchor-lang/core";
import {
  bid,
  buyLicense,
  buyListed,
  claimSeat,
  decodeAccount,
  listLeak,
  offerLicense,
  openLeak,
  ping,
  sendOrder,
  sendTx,
  sendWithWallet,
  tableAccounts,
  teeConnection,
  tx,
  type InsiderConfig,
} from "@insider/sdk";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createGuest } from "./guest";
import {
  playerKey,
  publishFixture,
  selectGuest,
  updateFloor,
  useFloorStore,
  type WalletSigner,
} from "./floor-store";

function current() {
  const state = useFloorStore.getState();
  if (!state.snapshot) throw new Error("The table is offline.");
  return { ...state, snapshot: state.snapshot };
}

function mySeat(owner: PublicKey) {
  const state = current();
  const seat = state.snapshot.seats.find((item) => item.owner.equals(owner));
  if (!seat) throw new Error("Claim a seat first.");
  return seat;
}

type Player = Keypair | WalletSigner;

function currentPlayer(): Player {
  const state = current();
  if (state.identity === "guest") {
    if (!state.guest) throw new Error("Claim a seat first.");
    return state.guest;
  }
  if (!state.wallet || !state.walletKey?.equals(state.wallet.publicKey))
    throw new Error("Connect a wallet that supports transaction and message signing.");
  return state.wallet;
}

async function execute(
  config: InsiderConfig,
  player: Player,
  instruction: Parameters<typeof tx>[number],
) {
  const connection = await teeConnection(config, player);
  if (player instanceof Keypair) await sendTx(connection, tx(instruction), [player]);
  else await sendWithWallet(connection, tx(instruction), player);
}

export async function joinFloor(config: InsiderConfig) {
  const state = current();
  if (state.identity === "guest" && !state.guest) selectGuest(createGuest());
  const player = currentPlayer();
  const existing = state.snapshot.seats.find((seat) => seat.owner.equals(player.publicKey));
  if (existing) return;
  const seats = state.snapshot.seats;
  const human = seats.slice(7, 10).find((seat) => seat.owner.equals(PublicKey.default));
  const bots = seats
    .slice(0, 5)
    .filter(
      (seat) =>
        seat.owner.equals(PublicKey.default) || state.snapshot.table.tick - seat.lastSeenTick >= 60,
    )
    .sort((a, b) => a.lastSeenTick - b.lastSeenTick);
  const selected = human ?? bots[0];
  if (!selected) throw new Error("No human seat or idle bot seat is available.");
  if (process.env.NODE_ENV !== "production" && state.fixture) {
    const { fixtureClaim } = await import("./fixture");
    fixtureClaim(state.fixture, player.publicKey, selected.index);
    publishFixture(state.fixture);
  } else {
    await execute(config, player, claimSeat(config, player.publicKey, selected.index));
  }
  updateFloor({ tutorial: true });
}

export async function keepSeatAlive(config: InsiderConfig) {
  const state = current();
  if (state.identity !== "guest" || !state.guest || state.fixture) return;
  const seat = state.snapshot.seats.find((s) => s.owner.equals(state.guest!.publicKey));
  if (seat) await execute(config, state.guest, ping(config, state.guest.publicKey, seat.index));
}

export async function submitOrder(config: InsiderConfig, sideSize: number, lane: number) {
  const state = current();
  const player = currentPlayer();
  const seat = mySeat(player.publicKey);
  const pending = state.pending.filter(
    (order) =>
      order.round === state.snapshot.table.roundId && order.landTick > state.snapshot.table.tick,
  );
  const position =
    seat.position + pending.reduce((sum, order) => sum + order.sideSize, 0) + sideSize;
  const params = state.snapshot.table.params;
  if (Math.abs(position) > params.maxPositionUnits) throw new Error("Position limit exceeded.");
  if (seat.pendingCount >= params.maxPending) throw new Error("Too many pending orders.");
  if (process.env.NODE_ENV !== "production" && state.fixture) {
    const { fixtureSend } = await import("./fixture");
    const order = fixtureSend(state.fixture, seat.index, sideSize, lane);
    publishFixture(state.fixture);
    updateFloor({ pending: [...pending, order] });
  } else {
    await execute(config, player, sendOrder(config, player.publicKey, seat.index, sideSize, lane));
    const sentTick = state.snapshot.table.tick;
    const delay = lane === 1 ? params.priorityDelay : params.standardDelay;
    if (!playerKey(useFloorStore.getState())?.equals(player.publicKey)) return;
    updateFloor({
      pending: [
        ...pending,
        {
          id: crypto.randomUUID(),
          sideSize,
          lane,
          sentTick,
          landTick: sentTick + delay,
          round: state.snapshot.table.roundId,
        },
      ],
    });
  }
}

async function fetchVault(config: InsiderConfig, slot: number, leakId: number) {
  const state = current();
  const player = currentPlayer();
  let vault;
  if (process.env.NODE_ENV !== "production" && state.fixture) {
    vault = state.fixture.vaults[slot];
  } else {
    if (!config.tableAuthority) throw new Error("Table authority is not configured.");
    const connection = await teeConnection(config, player);
    const address = tableAccounts(config.tableAuthority, config.programId).leakVaults[slot];
    if (!address) throw new Error("Invalid leak slot.");
    const info = await connection.getAccountInfo(address, "confirmed");
    if (!info) throw new Error("The TEE did not return this vault. Try again shortly.");
    vault = decodeAccount("leakVault", info.data);
  }
  if (!vault || vault.leakId !== leakId || vault.roundId !== state.snapshot.table.roundId)
    throw new Error("The vault no longer matches this leak.");
  if (!playerKey(useFloorStore.getState())?.equals(player.publicKey))
    throw new Error("The player changed while the Leak was loading.");
  updateFloor({ vaults: { ...useFloorStore.getState().vaults, [leakId]: vault } });
  return vault;
}

export type LeakAction = "bid" | "open" | "list" | "buy" | "offer" | "license";
export async function actOnLeak(config: InsiderConfig, action: LeakAction, slot: number, ask = 0) {
  const state = current();
  const player = currentPlayer();
  const seat = mySeat(player.publicKey);
  const header = state.snapshot.board.headers[slot];
  if (!header) throw new Error("Invalid leak slot.");
  const id = header.leakId;
  if (process.env.NODE_ENV !== "production" && state.fixture) {
    const { fixtureBid } = await import("./fixture");
    if (action === "bid") fixtureBid(state.fixture, seat.index, slot);
    if (action === "open") {
      header.state = 4;
      header.openedTick = state.snapshot.table.tick;
      header.readers[0] = player.publicKey;
      header.readerCount = 1;
    }
    if (action === "list") {
      header.state = ask ? 3 : 2;
      header.ask = ask;
    }
    if (action === "offer") header.licenseAsk = ask;
    if (action === "buy") {
      const seller = state.snapshot.seats[header.ownerSeat]!;
      const price = header.ask;
      seller.chips = new BN((BigInt(seller.chips.toString()) + BigInt(price)).toString());
      seat.chips = new BN((BigInt(seat.chips.toString()) - BigInt(price)).toString());
      seat.leakSpend = new BN((BigInt(seat.leakSpend.toString()) + BigInt(price)).toString());
      header.ownerSeat = seat.index;
      header.state = 2;
      header.ask = 0;
      header.paid = price;
      header.flips++;
    }
    if (action === "license") {
      const owner = state.snapshot.seats[header.ownerSeat]!;
      owner.chips = new BN((BigInt(owner.chips.toString()) + BigInt(header.licenseAsk)).toString());
      seat.chips = new BN((BigInt(seat.chips.toString()) - BigInt(header.licenseAsk)).toString());
      seat.leakSpend = new BN(
        (BigInt(seat.leakSpend.toString()) + BigInt(header.licenseAsk)).toString(),
      );
      header.readers[header.readerCount++] = player.publicKey;
    }
    publishFixture(state.fixture);
  } else {
    const owner = player.publicKey;
    const instruction =
      action === "bid"
        ? bid(config, owner, seat.index, slot)
        : action === "open"
          ? openLeak(config, owner, seat.index, slot)
          : action === "list"
            ? listLeak(config, owner, seat.index, slot, ask)
            : action === "buy"
              ? buyListed(config, owner, seat.index, slot, header.ownerSeat)
              : action === "offer"
                ? offerLicense(config, owner, seat.index, slot, ask)
                : buyLicense(config, owner, seat.index, slot, header.ownerSeat);
    await execute(config, player, instruction);
  }
  if (action === "open" || action === "license") {
    if (!playerKey(useFloorStore.getState())?.equals(player.publicKey))
      throw new Error("The player changed while the action was pending.");
    return fetchVault(config, slot, id);
  }
}

export async function restoreVault(config: InsiderConfig, slot: number, leakId: number) {
  const state = current();
  if (state.vaults[leakId]) return state.vaults[leakId];
  return fetchVault(config, slot, leakId);
}
