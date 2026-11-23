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
  tableAccounts,
  teeConnection,
  tx,
  type InsiderConfig,
} from "@insider/sdk";
import { PublicKey } from "@solana/web3.js";
import { createGuest } from "./guest";
import { fixtureBid, fixtureClaim, fixtureSend } from "./fixture";
import { publishFixture, updateFloor, useFloorStore } from "./floor-store";

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

async function execute(config: InsiderConfig, instruction: Parameters<typeof tx>[number]) {
  const guest = current().guest;
  if (!guest) throw new Error("Claim a seat first.");
  const connection = await teeConnection(config, guest);
  await sendTx(connection, tx(instruction), [guest]);
}

export async function joinFloor(config: InsiderConfig) {
  const state = current();
  const guest = state.guest ?? createGuest();
  updateFloor({ guest });
  const existing = state.snapshot.seats.find((seat) => seat.owner.equals(guest.publicKey));
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
  if (state.fixture) {
    fixtureClaim(state.fixture, guest.publicKey, selected.index);
    publishFixture(state.fixture);
  } else {
    await execute(config, claimSeat(config, guest.publicKey, selected.index));
  }
  updateFloor({ tutorial: true });
}

export async function keepSeatAlive(config: InsiderConfig) {
  const state = current();
  if (!state.guest || state.fixture) return;
  const seat = state.snapshot.seats.find((s) => s.owner.equals(state.guest!.publicKey));
  if (seat) await execute(config, ping(config, state.guest.publicKey, seat.index));
}

export async function submitOrder(config: InsiderConfig, sideSize: number, lane: number) {
  const state = current();
  if (!state.guest) throw new Error("Claim a seat first.");
  const seat = mySeat(state.guest.publicKey);
  const pending = state.pending.filter(
    (order) =>
      order.round === state.snapshot.table.roundId && order.landTick > state.snapshot.table.tick,
  );
  const position =
    seat.position + pending.reduce((sum, order) => sum + order.sideSize, 0) + sideSize;
  const params = state.snapshot.table.params;
  if (Math.abs(position) > params.maxPositionUnits) throw new Error("Position limit exceeded.");
  if (seat.pendingCount >= params.maxPending) throw new Error("Too many pending orders.");
  if (state.fixture) {
    const order = fixtureSend(state.fixture, seat.index, sideSize, lane);
    publishFixture(state.fixture);
    updateFloor({ pending: [...pending, order] });
  } else {
    await execute(config, sendOrder(config, state.guest.publicKey, seat.index, sideSize, lane));
    const sentTick = state.snapshot.table.tick;
    const delay = lane === 1 ? params.priorityDelay : params.standardDelay;
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
  if (!state.guest) throw new Error("Claim a seat first.");
  let vault;
  if (state.fixture) {
    vault = state.fixture.vaults[slot];
  } else {
    if (!config.tableAuthority) throw new Error("Table authority is not configured.");
    const connection = await teeConnection(config, state.guest);
    const address = tableAccounts(config.tableAuthority, config.programId).leakVaults[slot];
    if (!address) throw new Error("Invalid leak slot.");
    const info = await connection.getAccountInfo(address, "confirmed");
    if (!info) throw new Error("The TEE did not return this vault. Try again shortly.");
    vault = decodeAccount("leakVault", info.data);
  }
  if (!vault || vault.leakId !== leakId || vault.roundId !== state.snapshot.table.roundId)
    throw new Error("The vault no longer matches this leak.");
  updateFloor({ vaults: { ...useFloorStore.getState().vaults, [leakId]: vault } });
  return vault;
}

export type LeakAction = "bid" | "open" | "list" | "buy" | "offer" | "license";
export async function actOnLeak(config: InsiderConfig, action: LeakAction, slot: number, ask = 0) {
  const state = current();
  if (!state.guest) throw new Error("Claim a seat first.");
  const seat = mySeat(state.guest.publicKey);
  const header = state.snapshot.board.headers[slot];
  if (!header) throw new Error("Invalid leak slot.");
  const id = header.leakId;
  if (state.fixture) {
    if (action === "bid") fixtureBid(state.fixture, seat.index, slot);
    if (action === "open") {
      header.state = 4;
      header.openedTick = state.snapshot.table.tick;
      header.readers[0] = state.guest.publicKey;
      header.readerCount = 1;
    }
    if (action === "list") {
      header.state = ask ? 3 : 2;
      header.ask = ask;
    }
    if (action === "offer") header.licenseAsk = ask;
    if (action === "buy") {
      const seller = state.snapshot.seats[header.ownerSeat]!;
      seller.chips = new BN((BigInt(seller.chips.toString()) + BigInt(header.ask)).toString());
      seat.chips = new BN((BigInt(seat.chips.toString()) - BigInt(header.ask)).toString());
      header.ownerSeat = seat.index;
      header.state = 2;
      header.ask = 0;
    }
    if (action === "license") {
      const owner = state.snapshot.seats[header.ownerSeat]!;
      owner.chips = new BN((BigInt(owner.chips.toString()) + BigInt(header.licenseAsk)).toString());
      seat.chips = new BN((BigInt(seat.chips.toString()) - BigInt(header.licenseAsk)).toString());
      header.readers[header.readerCount++] = state.guest.publicKey;
    }
    publishFixture(state.fixture);
  } else {
    const owner = state.guest.publicKey;
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
    await execute(config, instruction);
  }
  if (action === "open" || action === "license") return fetchVault(config, slot, id);
}

export async function restoreVault(config: InsiderConfig, slot: number, leakId: number) {
  const state = current();
  if (state.vaults[leakId]) return state.vaults[leakId];
  return fetchVault(config, slot, leakId);
}
