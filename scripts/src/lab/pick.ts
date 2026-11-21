/**
 * Spike C: the VRF callback picks the reader and rewrites the private permission in one step.
 * This is the Insider mechanic: a random wallet is chosen onchain and is then the only wallet that
 * can read the hidden account.
 * Usage: pnpm lab:pick [--rounds 3]
 */
import { permissionPdaFromAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, PublicKey, type Transaction } from "@solana/web3.js";

import { Run, program, send } from "../lib/client.js";
import {
  ALL_FLAGS,
  type Session,
  delegateLab,
  labContext,
  resetLab,
  tryRead,
  undelegateLab,
} from "../lib/lab.js";
import { sleep } from "../lib/rpc.js";
import { teeAuthUrl } from "../lib/tee.js";

const EPHEMERAL_QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");

function parseRounds(argv: string[]): number {
  const index = argv.indexOf("--rounds");
  return index >= 0 ? Number(argv[index + 1]) : 3;
}

async function main() {
  const rounds = parseRounds(process.argv);
  const run = new Run("lab-pick-tee");
  const ctx = labContext(run);
  const permission = permissionPdaFromAccount(ctx.lab);
  run.note("lab", ctx.lab.toBase58());
  run.note("rounds", rounds);

  await resetLab(ctx);
  const session: Session = await delegateLab(ctx, "tee");

  // one authenticated connection per candidate wallet
  const readers = await Promise.all(
    ctx.candidates.map(async (keypair) => {
      const connection = new Connection(
        (await teeAuthUrl(session.endpoint, keypair)).url,
        "confirmed",
      );
      return { keypair, connection, client: program(connection, keypair) };
    }),
  );

  const send_ = async (step: string, tx: Transaction) =>
    send(session.er, ctx.payer, tx, { run, step, layer: "TEE", erUrl: session.endpoint });

  const accounts = { authority: ctx.payer.publicKey, lab: ctx.lab, permission };

  // private from the start, with the payer as the only member
  await send_(
    "lab_create_permission",
    await session.erProgram.methods
      .labCreatePermission(true, [{ flags: ALL_FLAGS, pubkey: ctx.payer.publicKey }])
      .accounts(accounts)
      .transaction(),
  );

  const picks: string[] = [];
  let failures = 0;

  for (let round = 1; round <= rounds; round++) {
    console.log(`\n--- round ${round} ---`);
    if (round > 1) {
      // reset to "payer only" so the next pick starts from a known state
      await send_(
        "lab_update_permission (reset to payer)",
        await session.erProgram.methods
          .labUpdatePermission(true, [{ flags: ALL_FLAGS, pubkey: ctx.payer.publicKey }])
          .accounts(accounts)
          .transaction(),
      );
    }

    await send_(
      `lab_request_pick #${round}`,
      await session.erProgram.methods
        .labRequestPick(Math.floor(Math.random() * 255))
        .accounts({
          payer: ctx.payer.publicKey,
          lab: ctx.lab,
          permission,
          oracleQueue: EPHEMERAL_QUEUE,
        })
        .transaction(),
    );

    // whoever can read the lab once the callback has landed is the picked reader
    const started = performance.now();
    let visibleTo: string[] = [];
    let blocked: string[] = [];
    let readState: { reader: PublicKey; rolls: number } | undefined;
    while (performance.now() - started < 60_000) {
      visibleTo = [];
      blocked = [];
      readState = undefined;
      for (const { keypair, connection, client } of readers) {
        const result = await tryRead(connection, client, ctx.lab);
        if (result.visible) {
          visibleTo.push(keypair.publicKey.toBase58());
          const info = await connection.getAccountInfo(ctx.lab);
          const decoded = client.coder.accounts.decode("lab", info!.data);
          readState = { reader: decoded.reader as PublicKey, rolls: decoded.rolls.toNumber() };
        } else {
          blocked.push(keypair.publicKey.toBase58());
        }
      }
      // callback done when the payer lost access or a different single reader holds it
      if (readState && readState.rolls >= round && visibleTo.length === 1) break;
      await sleep(1_000);
    }

    const picked = readState?.reader.toBase58();
    const ok =
      readState !== undefined &&
      readState.rolls >= round &&
      visibleTo.length === 1 &&
      visibleTo[0] === picked &&
      blocked.length === ctx.candidates.length - 1;
    if (!ok) failures++;
    if (picked) picks.push(picked);
    run.note(`round ${round}`, {
      pickedReader: picked ?? null,
      canRead: visibleTo,
      blocked: blocked.length,
      callbackSettledMs: Math.round(performance.now() - started),
      ok,
    });
  }

  run.note("distinctReadersPicked", new Set(picks).size);
  await send_(
    "lab_close_permission",
    await session.erProgram.methods.labClosePermission().accounts(accounts).transaction(),
  );
  await undelegateLab(ctx, session);
  run.note("failures", failures);
  run.writeProof();
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
