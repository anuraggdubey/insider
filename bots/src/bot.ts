/**
 * One running bot: reads the table on the TEE with its own key, asks its persona what to do, sends
 * the transactions, and (like every seat) keeps the table alive: scores and reseals a finished
 * round, starts the next one and re-arms the crank. Errors are the caller's to log; the loop goes on.
 */
import type { Logger } from "pino";
import {
  Connection,
  type Keypair,
  type PublicKey,
  type TransactionInstruction,
} from "@solana/web3.js";

import {
  EPHEMERAL_VRF_QUEUE,
  type InsiderConfig,
  bid,
  cancelVrf,
  claimSeat,
  cycleStateFrom,
  decodeBoard,
  decodeLeakVault,
  decodeMarket,
  decodeSeat,
  decodeTable,
  decodeXray,
  finishRound,
  needsArming,
  nextAction,
  openLeak,
  ping,
  rearmTicks,
  requestRoundSeed,
  resealLeaks,
  sendOrder,
  sendTx,
  tableAccounts,
  teeAuthUrl,
  tx,
} from "@insider/sdk/node";

import { type Decoded, buildView } from "./observe.js";
import type { Member } from "./roster.js";
import type { Payload } from "./signal.js";
import { type Memory, decide, newMemory } from "./strategies.js";
import type { Action, BotView } from "./view.js";

const DRIVE_COOLDOWN_MS = 4_000;
const ARM_CHECK_MS = 30_000;
const PING_MS = 20_000;

type Seen = Awaited<ReturnType<Bot["observe"]>>;

export class Bot {
  private readonly memory: Memory = newMemory();
  private readonly payloads = new Map<string, Payload>();
  private readonly accounts;
  private rollup?: { url: string; connection: Connection };
  private lastDrive = 0;
  private lastArmCheck = 0;
  private lastPing = 0;

  constructor(
    readonly member: Member,
    private readonly keypair: Keypair,
    private readonly config: InsiderConfig,
    private readonly log: Logger,
  ) {
    this.accounts = tableAccounts(config.tableAuthority!, config.programId);
  }

  get me() {
    return this.keypair.publicKey;
  }

  /** A connection whose auth token is refreshed when it expires (the SDK caches it). */
  private async connection(): Promise<Connection> {
    const { url } = await teeAuthUrl(this.config.teeRpcUrl, this.keypair);
    if (this.rollup?.url !== url) {
      this.rollup = { url, connection: new Connection(url, "confirmed") };
    }
    return this.rollup.connection;
  }

  private async send(what: string, ...ix: TransactionInstruction[]) {
    const connection = await this.connection();
    const { signature, ms } = await sendTx(connection, tx(...ix), [this.keypair]);
    this.log.info({ signature, ms }, what);
    return signature;
  }

  /** Reads everything one decision needs in one round trip. */
  private async observe() {
    const connection = await this.connection();
    const p = this.accounts;
    const [table, market, board, seat, xray, slot] = await Promise.all([
      connection.getAccountInfo(p.table),
      connection.getAccountInfo(p.floor),
      connection.getAccountInfo(p.board),
      connection.getAccountInfo(p.seats[this.member.seat]!),
      connection.getAccountInfo(p.xray),
      connection.getSlot(),
    ]);
    if (!table || !market || !board || !seat || !xray) {
      throw new Error("table accounts not readable");
    }
    return {
      table: decodeTable(table.data),
      market: decodeMarket(market.data),
      board: decodeBoard(board.data),
      seat: decodeSeat(seat.data),
      xray: decodeXray(xray.data),
      slot,
    };
  }

  private async readPayload(slot: number, round: number, leakId: number) {
    const key = `${round}:${leakId}`;
    if (this.payloads.has(key)) return;
    const info = await (await this.connection()).getAccountInfo(this.accounts.leakVaults[slot]!);
    if (!info) return;
    const vault = decodeLeakVault(info.data);
    if (vault.leakId !== leakId || vault.roundId !== round) return;
    this.payloads.set(key, {
      kind: vault.kind,
      fields: [...vault.fields],
      orders: vault.orders.map((order) => ({ sideSize: order.sideSize, landTick: order.landTick })),
      orderCount: vault.orderCount,
    });
  }

  /** One decision: housekeeping for the table first, then the persona. */
  async step(): Promise<void> {
    const seen = await this.observe();
    await this.housekeeping(seen);

    const { table } = seen;
    const decoded: Decoded = {
      table,
      market: seen.market,
      board: seen.board,
      seat: seen.seat,
      liquidated: Boolean(seen.market.liquidatedMask & (1 << seen.seat.index)),
    };
    // payloads this bot has already read, so the persona does not wait a decision for them
    const payloads = new Map<number, Payload>();
    for (const [slot, header] of seen.board.headers.entries()) {
      const cached = this.payloads.get(`${table.roundId}:${header.leakId}`);
      const reads = header.readers.slice(0, header.readerCount).some((r: PublicKey) => r.equals(this.me));
      if (cached && reads) payloads.set(slot, cached);
    }
    const view = buildView(decoded, this.me, payloads);
    for (const action of decide(this.member.persona, view, this.memory)) {
      await this.run(action, view);
    }
  }

  private async run(action: Action, view: BotView) {
    const { me, config } = this;
    const index = this.member.seat;
    switch (action.type) {
      case "claim":
        await this.send(`claim seat ${index}`, claimSeat(config, me, index));
        break;
      case "ping":
        await this.send("ping", ping(config, me, index));
        break;
      case "bid":
        await this.send(`bid on slot ${action.slot}`, bid(config, me, index, action.slot));
        break;
      case "open":
        await this.send(`open slot ${action.slot}`, openLeak(config, me, index, action.slot));
        break;
      case "read":
        await this.readPayload(action.slot, view.roundId, view.leaks[action.slot]!.leakId);
        break;
      case "order": {
        const side = action.sideSize > 0 ? "buy" : "sell";
        await this.send(
          `order ${side} ${Math.abs(action.sideSize)} (${action.note})`,
          sendOrder(config, me, index, action.sideSize, action.lane),
        );
        break;
      }
    }
  }

  /** What every seat does to keep rounds flowing; duplicates from other bots are harmless. */
  private async housekeeping(seen: Seen) {
    const now = Date.now();
    const { table, slot } = seen;
    const { me, config } = this;

    if (now - this.lastDrive > DRIVE_COOLDOWN_MS) {
      const action = nextAction(cycleStateFrom(table, seen.board, seen.xray, slot));
      if (action !== "wait") {
        // a random hold-off so several bots do not all send the same transaction at once
        this.lastDrive = now + Math.random() * 2_000;
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 1_500));
        try {
          if (action === "finish_round") {
            await this.send("finish_round", finishRound(config, me));
          } else if (action === "reseal_leaks") {
            await this.send("reseal_leaks", resealLeaks(config, me, 0, 6));
          } else if (action === "request_round_seed") {
            await this.send("request_round_seed", requestRoundSeed(config, me, EPHEMERAL_VRF_QUEUE));
          } else if (action === "cancel_vrf") {
            await this.send("cancel_vrf", cancelVrf(config, me));
          }
        } catch (error) {
          this.log.debug({ action, error: String(error) }, "another seat got there first");
        }
      }
    }

    if (now - this.lastArmCheck > ARM_CHECK_MS) {
      this.lastArmCheck = now;
      if (needsArming(Number(table.armedUntilSlot.toString()), slot)) {
        try {
          await this.send("rearm_ticks", rearmTicks(config, me, now % 1_000_000_000));
        } catch (error) {
          this.log.debug({ error: String(error) }, "rearm skipped");
        }
      }
    }

    if (now - this.lastPing > PING_MS && seen.seat.owner.equals(me)) {
      this.lastPing = now;
      await this.send("ping", ping(config, me, this.member.seat));
    }
  }
}
