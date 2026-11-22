/**
 * G4 Oracle in the TEE: can a program read a fresh SOL/USD feed inside the TEE? Decides the Desk.
 *
 * Checks the feed account on the TEE (owner, age, value), then has `probe_read_oracle` decode it
 * inside the rollup and compares the on-chain read with the off-chain one.
 */
import { Connection, PublicKey } from "@solana/web3.js";

import {
  ER_URL,
  Gate,
  TEE_URL,
  closePermission,
  context,
  delegateProbe,
  readProbe,
  resetProbe,
  runIfMain,
  send,
  sleep,
  undelegateProbe,
} from "./lib.js";

const PRICING_ORACLE = new PublicKey("PriCems5tHihc6UDXDjzjeawomAwBduWMGAi8ZUjppd");
/** SOL/USD (Pyth Lazer id 6): PDA ["price_feed", "pyth-lazer", "6"] under the pricing oracle. */
const SOL_USD = PublicKey.findProgramAddressSync(
  [Buffer.from("price_feed"), Buffer.from("pyth-lazer"), Buffer.from("6")],
  PRICING_ORACLE,
)[0];
/** The stored exponent is +8 on every feed; the real one comes from the feed list (-8 for SOL/USD). */
const REAL_EXPONENT = -8;
const MAX_AGE_SECONDS = 10;

type Decoded = { price: bigint; publishTime: number; postedSlot: bigint; verification: number };

/** Same layout as the on-chain decoder in programs/gates. */
function decode(data: Buffer): Decoded {
  let offset = 8 + 32;
  const verification = data[offset]!;
  offset += verification === 0 ? 2 : 1;
  offset += 32;
  const price = data.readBigInt64LE(offset);
  offset += 8 + 8 + 4;
  const publishTime = Number(data.readBigInt64LE(offset));
  offset += 8 * 4;
  const postedSlot = data.readBigUInt64LE(offset);
  return { price, publishTime, postedSlot, verification };
}

const usd = (price: bigint) => Number(price) * 10 ** REAL_EXPONENT;

export async function run() {
  const gate = new Gate("G4", "Oracle in the TEE");
  const ctx = context(gate);
  gate.note("feed", SOL_USD.toBase58());
  gate.note("oracleProgram", PRICING_ORACLE.toBase58());

  // 1. where does the feed exist, and how fresh is it?
  const places: Record<string, unknown> = {};
  for (const [name, url] of [
    ["tee", TEE_URL],
    ["er-asia", ER_URL],
    ["base", ctx.base.rpcEndpoint],
  ] as const) {
    try {
      const connection = new Connection(url, "confirmed");
      const info = await connection.getAccountInfo(SOL_USD);
      if (!info) {
        places[name] = "account not found";
        continue;
      }
      const decoded = decode(info.data);
      places[name] = {
        owner: info.owner.toBase58(),
        ownerIsOracle: info.owner.equals(PRICING_ORACLE),
        priceUsd: usd(decoded.price),
        ageSeconds: Math.round(Date.now() / 1000 - decoded.publishTime),
        postedSlot: decoded.postedSlot.toString(),
        size: info.data.length,
      };
    } catch (error) {
      places[name] = `error: ${(error as Error).message.slice(0, 80)}`;
    }
  }
  gate.note("feedByLayer", places);
  const tee = places.tee as { ownerIsOracle?: boolean; ageSeconds?: number; priceUsd?: number };
  if (typeof tee !== "object" || !tee.ownerIsOracle) {
    return gate.finish(
      "cut",
      "The SOL/USD feed account is not readable on the TEE with the oracle as owner: the Desk is cut.",
    );
  }

  // 2. decode it inside the rollup with program code
  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");
  const reads: Array<{ price: number; ageAtRead: number; postedSlot: string }> = [];
  for (let i = 0; i < 3; i++) {
    await send(
      gate,
      session.er,
      await session.erProgram.methods
        .probeReadOracle()
        .accounts({ probe: ctx.probe, feed: SOL_USD })
        .transaction(),
      [ctx.payer],
      `probe_read_oracle #${i + 1}`,
      "TEE",
      session.endpoint,
    );
    const state = (await readProbe(session.er, session.erProgram, ctx.probe))!;
    reads.push({
      price: Number(state.oraclePrice.toString()) * 10 ** REAL_EXPONENT,
      ageAtRead: state.oracleClock.toNumber() - state.oraclePublishTime.toNumber(),
      postedSlot: state.oraclePostedSlot.toNumber().toString(),
    });
    await sleep(1_500);
  }
  gate.note("onChainReads", reads);
  await closePermission(ctx, session).catch(() => undefined);
  await undelegateProbe(ctx, session);

  const fresh = reads.every((r) => r.ageAtRead >= 0 && r.ageAtRead <= MAX_AGE_SECONDS);
  const sane = reads.every((r) => r.price > 1 && r.price < 10_000);
  const moved = new Set(reads.map((r) => r.postedSlot)).size > 1;
  gate.note("fresh", fresh);
  gate.note("sanePrice", sane);
  gate.note("updatesBetweenReads", moved);
  if (fresh && sane) {
    return gate.finish(
      "pass",
      `A program inside the TEE reads SOL/USD (about $${reads[0]!.price.toFixed(2)}, age under ${MAX_AGE_SECONDS}s). The Desk is in. Decode as PriceUpdateV3 by layout, exponent ${REAL_EXPONENT} from the feed list.`,
    );
  }
  return gate.finish(
    "cut",
    `The on-chain read was not fresh or sane (fresh ${fresh}, sane ${sane}): the Desk is cut.`,
  );
}

runIfMain(import.meta.url, run);
