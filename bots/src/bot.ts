/**
 * One running bot: reads the table on the TEE with its own key, asks its persona what to do, sends
 * the transactions, and (like every seat) keeps the table alive: scores and reseals a finished
 * round, starts the next one, re-arms the crank, commits epochs and judges due Desk Calls. Errors
 * are the caller's to log; the loop goes on.
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
  buyCallLicense,
  buyLicense,
  buyListed,
  cancelVrf,
  claimSeat,
  commitEpoch,
  cycleStateFrom,
  decodeBoard,
  decodeCallBook,
  decodeCallVault,
  decodeLeakVault,
  decodeMarket,
  decodeSeat,
  decodeTable,
  decodeXray,
  deskTrade,
  finishRound,
  listLeak,
  needsArming,
  nextAction,
  offerLicense,
  openLeak,
  ping,
  rearmTicks,
  requestRoundSeed,
  resealLeaks,
  sendOrder,
  sendTx,
  settleCall,
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
const SETTLE_RETRY_MS = 6_000;

export type Seen = Awaited<ReturnType<Bot["observe"]>>;

/** Extra per-decision work a specialised bot (the AI analysts) plugs in after housekeeping. */
export type Extra = (bot: Bot, seen: Seen) => Promise<void>;

export class Bot {
  private readonly memory: Memory = newMemory();
  private readonly payloads = new Map<string, Payload>();
  private readonly directions = new Map<number, { callId: number; direction: 1 | -1 }>();
  private readonly settleTried = new Map<number, number>();
  readonly accounts;
  private rollup?: { url: string; connection: Connection };
  private lastDrive = 0;
  private lastArmCheck = 0;
  private lastPing = 0;

  constructor(
    readonly member: Member,
    readonly keypair: Keypair,
    readonly config: InsiderConfig,
    readonly log: Logger,
    private readonly extra?: Extra,
  ) {
    this.accounts = tableAccounts(config.tableAuthority!, config.programId);
  }

  get me(): PublicKey {
    return this.keypair.publicKey;
  }

  /** A connection whose auth token is refreshed when it expires (the SDK caches it). */
  async connection(): Promise<Connection> {
    const { url } = await teeAuthUrl(this.config.teeRpcUrl, this.keypair);
    if (this.rollup?.url !== url) {
      this.rollup = { url, connection: new Connection(url, "confirmed") };
    }
    return this.rollup.connection;
  }

  async send(what: string, ...ix: TransactionInstruction[]) {
    const connection = await this.connection();
    const { signature, ms } = await sendTx(connection, tx(...ix), [this.keypair]);
    this.log.info({ signature, ms }, what);
    return signature;
  }

  /** Reads everything one decision needs in one round trip. */
  async observe() {
    const connection = await this.connection();
    const p = this.accounts;
    const keys = [p.table, p.floor, p.board, p.xray, p.callBook, ...p.seats];
    const [infos, slot] = await Promise.all([
      connection.getMultipleAccountsInfo(keys),
      connection.getSlot(),
    ]);
    const [table, market, board, xray, callBook, ...seatInfos] = infos;
    if (!table || !market || !board || !xray || !callBook || seatInfos.some((s) => !s)) {
      throw new Error("table accounts not readable");
    }
    const seats = seatInfos.map((info) => decodeSeat(info!.data));
    return {
      table: decodeTable(table.data),
      market: decodeMarket(market.data),
      board: decodeBoard(board.data),
      xray: decodeXray(xray.data),
      calls: decodeCallBook(callBook.data).headers,
      seats,
      seat: seats[this.member.seat]!,
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

  /** The direction of a Call this seat holds a licence for, once read from its private vault. */
  private async readCall(author: number, callId: number) {
    if (this.directions.get(author)?.callId === callId) return;
    const info = await (await this.connection()).getAccountInfo(this.accounts.callVaults[author]!);
    if (!info) return;
    const vault = decodeCallVault(info.data);
    if (vault.callId !== callId || vault.direction === 0) return;
    this.directions.set(author, { callId, direction: vault.direction > 0 ? 1 : -1 });
  }

  /** One decision: housekeeping for the table first, then the persona. */
  async step(): Promise<void> {
    const seen = await this.observe();
    await this.housekeeping(seen);
    if (this.extra) await this.extra(this, seen);

    const { table } = seen;
    const decoded: Decoded = {
      table,
      market: seen.market,
      board: seen.board,
      seat: seen.seat,
      liquidated: Boolean(seen.market.liquidatedMask & (1 << seen.seat.index)),
      seats: seen.seats,
      calls: seen.calls,
    };
    // payloads this bot has already read, so the persona does not wait a decision for them
    const payloads = new Map<number, Payload>();
    for (const [slot, header] of seen.board.headers.entries()) {
      const cached = this.payloads.get(`${table.roundId}:${header.leakId}`);
      const reads = header.readers
        .slice(0, header.readerCount)
        .some((r: PublicKey) => r.equals(this.me));
      if (cached && reads) payloads.set(slot, cached);
    }
    const directions = new Map<number, 1 | -1>();
    for (const call of seen.calls) {
      const known = this.directions.get(call.authorSeat);
      if (call.state === 1 && known && known.callId === call.callId) {
        directions.set(call.authorSeat, known.direction);
      }
    }
    const view = buildView(decoded, this.me, payloads, directions);
    for (const action of decide(this.member.persona, view, this.memory)) {
      try {
        await this.run(action, view);
      } catch (error) {
        // a lost race for a Leak or a refused licence must not stop the rest of the decision
        this.log.debug(
          { action: action.type, error: String(error).slice(0, 160) },
          "action failed",
        );
      }
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
      case "listLeak":
        await this.send(
          `list slot ${action.slot} for ${action.ask}`,
          listLeak(config, me, index, action.slot, action.ask),
        );
        break;
      case "buyListed":
        await this.send(
          `buy the listed Leak in slot ${action.slot}`,
          buyListed(config, me, index, action.slot, action.seller),
        );
        break;
      case "offerLicense":
        await this.send(
          `offer licences for slot ${action.slot} at ${action.ask}`,
          offerLicense(config, me, index, action.slot, action.ask),
        );
        break;
      case "buyLicense":
        await this.send(
          `buy a licence for slot ${action.slot}`,
          buyLicense(config, me, index, action.slot, action.owner),
        );
        break;
      case "buyCallLicense":
        await this.send(
          `buy the licence of seat ${action.author + 1}'s Call`,
          buyCallLicense(config, me, index, action.author),
        );
        break;
      case "readCall": {
        const call = view.calls.find((c) => c.author === action.author);
        if (call) await this.readCall(action.author, call.callId);
        break;
      }
      case "deskTrade":
        await this.send(
          `desk trade ${action.size} (${action.note})`,
          deskTrade(config, me, index, action.size),
        );
        break;
    }
  }

  /** What every seat does to keep rounds flowing; duplicates from other bots are harmless. */
  private async housekeeping(seen: Seen) {
    const now = Date.now();
    const { table, slot } = seen;
    const { me, config } = this;

    if (now - this.lastDrive > DRIVE_COOLDOWN_MS) {
      const action = nextAction(cycleStateFrom(table, seen.board, seen.xray, slot), {
        epochs: true,
      });
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
            await this.send(
              "request_round_seed",
              requestRoundSeed(config, me, EPHEMERAL_VRF_QUEUE),
            );
          } else if (action === "commit_epoch") {
            await this.send("commit_epoch", commitEpoch(config, me));
          } else if (action === "cancel_vrf") {
            await this.send("cancel_vrf", cancelVrf(config, me));
          }
        } catch (error) {
          this.log.debug({ action, error: String(error) }, "another seat got there first");
        }
      }
    }

    // judge Desk Calls that are due: anyone may, and the author must not be the only one to
    const nowSec = Math.floor(now / 1000);
    for (const call of seen.calls) {
      if (call.state !== 1 || Number(call.expiryTs.toString()) > nowSec) continue;
      const author = call.authorSeat;
      if (now - (this.settleTried.get(author) ?? 0) < SETTLE_RETRY_MS) continue;
      this.settleTried.set(author, now + Math.random() * 3_000);
      try {
        await this.send(`settle the Call of seat ${author + 1}`, settleCall(config, me, author));
      } catch (error) {
        this.log.debug({ author, error: String(error).slice(0, 120) }, "settle skipped");
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
