/**
 * G3 Zero-balance key: can a key with 0 SOL sign on the TEE? If yes, guests need no funding.
 * If not, guests get one treasury transfer of 0.01 SOL at seat claim.
 */
import { Keypair, Transaction } from "@solana/web3.js";

import {
  Gate,
  context,
  delegateProbe,
  readProbe,
  resetProbe,
  runIfMain,
  send,
  undelegateProbe,
} from "./lib.js";

export async function run() {
  const gate = new Gate("G3", "Zero-balance key");
  const ctx = context(gate);
  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");

  // a brand-new key that has never held SOL anywhere
  const guest = Keypair.generate();
  gate.note("guest", guest.publicKey.toBase58());
  gate.note("guestBaseBalance", await ctx.base.getBalance(guest.publicKey));

  const attempts: Array<{ name: string; ok: boolean; detail: string }> = [];
  const attempt = async (name: string, build: () => Promise<Transaction>, feePayer: Keypair) => {
    try {
      await send(
        gate,
        session.er,
        await build(),
        [guest, feePayer],
        name,
        "TEE",
        session.endpoint,
        feePayer,
      );
      attempts.push({ name, ok: true, detail: "landed" });
    } catch (error) {
      attempts.push({
        name,
        ok: false,
        detail: (error as Error).message.replace(/\s+/g, " ").slice(0, 140),
      });
    }
  };

  // 1. the guest is fee payer and only signer (the real zero-balance case)
  await attempt(
    "guest is fee payer: probe_ping",
    () => session.erProgram.methods.probePing().accounts({ sender: guest.publicKey }).transaction(),
    guest,
  );
  // 2. the guest is fee payer and writes a delegated account (what send_order does)
  await attempt(
    "guest is fee payer: probe_send_secret",
    () =>
      session.erProgram.methods
        .probeSendSecret(77)
        .accounts({ sender: guest.publicKey, probe: ctx.probe })
        .transaction(),
    guest,
  );
  // 3. the guest only signs; a funded key pays the fee (a relayer model)
  await attempt(
    "funded fee payer, guest signs: probe_send_secret",
    () =>
      session.erProgram.methods
        .probeSendSecret(78)
        .accounts({ sender: guest.publicKey, probe: ctx.probe })
        .transaction(),
    ctx.payer,
  );

  gate.note("attempts", attempts);
  const state = await readProbe(session.er, session.erProgram, ctx.probe);
  gate.note("secretAfter", state?.secret ?? null);
  gate.note(
    "guestBalanceAfterOnTee",
    await session.er.getBalance(guest.publicKey).catch(() => null),
  );

  await undelegateProbe(ctx, session);

  const selfPaid = attempts[0]!.ok && attempts[1]!.ok;
  if (selfPaid) {
    return gate.finish(
      "pass",
      "A key with 0 SOL signs and pays its own transactions on the TEE. Guest onboarding needs no funding.",
    );
  }
  if (attempts[2]!.ok) {
    return gate.finish(
      "cut",
      "A zero-balance key cannot be its own fee payer on the TEE. Guests get one treasury transfer of 0.01 SOL at seat claim (or a funded relayer pays).",
    );
  }
  return gate.finish("error", "No variant landed; see facts.attempts.");
}

runIfMain(import.meta.url, run);
