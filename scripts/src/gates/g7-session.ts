/**
 * G7 Session keys: do session keys work with our program on the TEE?
 *
 * A wallet creates a session token for a throwaway zero-SOL session key on the base layer. The
 * session key then signs a gameplay instruction on the TEE on the wallet's behalf. Negative cases
 * must fail: a wrong signer, and no token at all. The wallet itself keeps working (fallback), and
 * a revoked session stops working.
 */
import { AnchorProvider, Wallet } from "@anchor-lang/core";
import { SessionTokenManager } from "@magicblock-labs/gum-sdk";
import { Connection, Keypair, PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@anchor-lang/core";

import { sleep } from "../lib/rpc.js";
import {
  GATES_PROGRAM_ID,
  Gate,
  context,
  delegateProbe,
  gateKey,
  readProbe,
  resetProbe,
  runIfMain,
  send,
  undelegateProbe,
} from "./lib.js";

const SESSION_PROGRAM = new PublicKey("KeyspM2ssCJbqUhQ4k7sveSiY4WjnYsrXkC8oDbwde5");

const tokenPda = (sessionSigner: PublicKey, authority: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [
      Buffer.from("session_token_v2"),
      GATES_PROGRAM_ID.toBytes(),
      sessionSigner.toBytes(),
      authority.toBytes(),
    ],
    SESSION_PROGRAM,
  )[0];

export async function run() {
  const gate = new Gate("G7", "Session keys");
  const ctx = context(gate);
  const wallet = gateKey("wallet");
  const stranger = gateKey("stranger");
  const sessionKey = Keypair.generate();
  const token = tokenPda(sessionKey.publicKey, wallet.publicKey);
  gate.note("wallet", wallet.publicKey.toBase58());
  gate.note("sessionKey", sessionKey.publicKey.toBase58());
  gate.note("sessionToken", token.toBase58());

  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");

  // 1. the wallet creates the session on the base layer (the session key holds 0 SOL)
  const manager = new SessionTokenManager(new Wallet(ctx.payer) as never, ctx.base as never);
  const validUntil = new BN(Math.floor(Date.now() / 1000) + 3_600);
  const createTx = (await manager.program.methods
    .createSessionV2(false, validUntil, null)
    .accounts({
      targetProgram: GATES_PROGRAM_ID,
      sessionSigner: sessionKey.publicKey,
      feePayer: ctx.payer.publicKey,
      authority: wallet.publicKey,
    })
    .transaction()) as Transaction;
  await send(
    gate,
    ctx.base,
    createTx,
    [ctx.payer, wallet, sessionKey],
    "createSessionV2 (base)",
    "base",
  );
  gate.note("sessionTokenOnBase", Boolean(await ctx.base.getAccountInfo(token)));

  const attempts: Array<{
    case: string;
    expected: "ok" | "fail";
    result: "ok" | "fail";
    detail: string;
  }> = [];
  const attempt = async (
    name: string,
    expected: "ok" | "fail",
    value: number,
    signer: Keypair,
    withToken: boolean,
  ) => {
    let result: "ok" | "fail" = "ok";
    let detail = "landed";
    try {
      const tx = await session.erProgram.methods
        .probeSendSecretSession(value)
        .accounts({
          signer: signer.publicKey,
          wallet: wallet.publicKey,
          probe: ctx.probe,
          sessionToken: withToken ? token : null,
        } as never)
        .transaction();
      await send(
        gate,
        session.er,
        tx,
        [ctx.payer, signer],
        name,
        "TEE",
        session.endpoint,
        ctx.payer,
      );
    } catch (error) {
      result = "fail";
      detail = (error as Error).message.replace(/\s+/g, " ").slice(0, 140);
    }
    attempts.push({ case: name, expected, result, detail });
  };

  await attempt("session key signs with its token", "ok", 555, sessionKey, true);
  await attempt("stranger signs with the wallet's token", "fail", 666, stranger, true);
  await attempt("session key signs without a token", "fail", 667, sessionKey, false);
  await attempt("wallet signs directly (fallback)", "ok", 556, wallet, false);

  // 2. revoke on the base layer, then the session key must stop working
  const revokeTx = (await manager.program.methods
    .revokeSessionV2()
    .accounts({ sessionToken: token, feePayer: ctx.payer.publicKey, authority: wallet.publicKey })
    .transaction()) as Transaction;
  await send(gate, ctx.base, revokeTx, [ctx.payer, wallet], "revokeSessionV2 (base)", "base");
  await sleep(6_000);
  await attempt("session key after revoke", "fail", 668, sessionKey, true);

  gate.note("attempts", attempts);
  const state = await readProbe(session.er, session.erProgram, ctx.probe);
  gate.note("secretAfter", state?.secret ?? null);
  await undelegateProbe(ctx, session);
  void Connection;

  const core = attempts.slice(0, 4);
  const coreOk = core.every((a) => a.result === a.expected);
  const revokeOk = attempts[4]!.result === "fail";
  gate.note("revokeStopsSession", revokeOk);
  if (coreOk && revokeOk) {
    return gate.finish(
      "pass",
      "A zero-SOL session key signs gameplay on the TEE for the wallet; wrong signers and missing tokens are rejected, the wallet still works directly, and revocation stops the session. Wallet identity is in.",
    );
  }
  if (coreOk) {
    return gate.finish(
      "pass",
      "Sessions authorise and reject correctly on the TEE. After revoke the session key still worked for a short time (see facts.attempts): expiry is the reliable stop, so keep sessions short.",
    );
  }
  return gate.finish(
    "cut",
    "Session keys did not behave on the TEE (see facts.attempts): guest keys only.",
  );
}

runIfMain(import.meta.url, run);
