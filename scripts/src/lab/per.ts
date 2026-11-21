/**
 * Spike B: Private Ephemeral Rollup permissions on the TEE.
 * Proves that only members of an ephemeral permission can read the lab, that the member list can
 * be changed live, and that a revoked member loses access.
 * Usage: pnpm lab:per
 */
import { permissionPdaFromAccount } from "@magicblock-labs/ephemeral-rollups-sdk";
import { Connection, type Keypair } from "@solana/web3.js";

import { Run, send } from "../lib/client.js";
import {
  ALL_FLAGS,
  FLAGS,
  type LabCtx,
  type Member,
  type ReadResult,
  type Session,
  delegateLab,
  labContext,
  resetLab,
  tryRead,
  undelegateLab,
} from "../lib/lab.js";
import { program } from "../lib/client.js";
import { sleep } from "../lib/rpc.js";
import { teeAuthUrl } from "../lib/tee.js";

let failures = 0;

async function expectRead(
  ctx: LabCtx,
  label: string,
  connection: Connection,
  expectVisible: boolean,
  who: Keypair,
) {
  const reader = program(connection, who);
  const started = performance.now();
  let result: ReadResult = await tryRead(connection, reader, ctx.lab);
  while (result.visible !== expectVisible && performance.now() - started < 20_000) {
    await sleep(1_000);
    result = await tryRead(connection, reader, ctx.lab);
  }
  const ok = result.visible === expectVisible;
  if (!ok) failures++;
  const entry = {
    expectedVisible: expectVisible,
    visible: result.visible,
    secretSeen: result.secret ?? null,
    detail: result.detail,
    settledMs: Math.round(performance.now() - started),
    ok,
  };
  ctx.run.note(`read:${label}`, entry);
}

async function main() {
  const run = new Run("lab-per-tee");
  const ctx = labContext(run);
  const [payer, member, outsider] = ctx.candidates;
  const permission = permissionPdaFromAccount(ctx.lab);
  run.note("lab", ctx.lab.toBase58());
  run.note("permission", permission.toBase58());
  run.note("member", member!.publicKey.toBase58());
  run.note("outsider", outsider!.publicKey.toBase58());

  await resetLab(ctx);
  const session: Session = await delegateLab(ctx, "tee");

  const asPayer = session.er;
  const asMember = new Connection((await teeAuthUrl(session.endpoint, member!)).url, "confirmed");
  const asOutsider = new Connection(
    (await teeAuthUrl(session.endpoint, outsider!)).url,
    "confirmed",
  );
  const anonymous = new Connection(session.endpoint, "confirmed");

  const permissionAccounts = {
    authority: payer!.publicKey,
    lab: ctx.lab,
    permission,
  };
  const sendPermission = async (
    step: string,
    build: () => Promise<import("@solana/web3.js").Transaction>,
  ) =>
    send(session.er, ctx.payer, await build(), {
      run,
      step,
      layer: "TEE",
      erUrl: session.endpoint,
    });
  const updateMembers = (step: string, isPrivate: boolean, members: Member[]) =>
    sendPermission(step, () =>
      session.erProgram.methods
        .labUpdatePermission(isPrivate, members)
        .accounts(permissionAccounts)
        .transaction(),
    );

  // 1. before any permission the account is public on the TEE
  await expectRead(ctx, "1 before permission / anonymous", anonymous, true, outsider!);

  // 2. create a private permission whose only member is the payer
  await sendPermission("lab_create_permission", () =>
    session.erProgram.methods
      .labCreatePermission(true, [{ flags: ALL_FLAGS, pubkey: payer!.publicKey }])
      .accounts(permissionAccounts)
      .transaction(),
  );
  await expectRead(ctx, "2 private / member payer", asPayer, true, payer!);
  await expectRead(ctx, "2 private / anonymous", anonymous, false, outsider!);
  await expectRead(ctx, "2 private / outsider", asOutsider, false, outsider!);
  await expectRead(ctx, "2 private / not-yet-added member", asMember, false, member!);

  // 3. add a member with log visibility only: does a non-authority flag grant account reads?
  await updateMembers("lab_update_permission (add member, TX_LOGS)", true, [
    { flags: ALL_FLAGS, pubkey: payer!.publicKey },
    { flags: FLAGS.TX_LOGS, pubkey: member!.publicKey },
  ]);
  await expectRead(ctx, "3 member with TX_LOGS only", asMember, true, member!);
  await expectRead(ctx, "3 outsider still blocked", asOutsider, false, outsider!);

  // 4. revoke the member by omitting them from the list
  await updateMembers("lab_update_permission (revoke member)", true, [
    { flags: ALL_FLAGS, pubkey: payer!.publicKey },
  ]);
  await expectRead(ctx, "4 member after revocation", asMember, false, member!);
  await expectRead(ctx, "4 payer still reads", asPayer, true, payer!);

  // 5. make it public again
  await updateMembers("lab_update_permission (public)", false, []);
  await expectRead(ctx, "5 public again / anonymous", anonymous, true, outsider!);

  // 6. clean exit: close the permission, then commit and undelegate
  await sendPermission("lab_close_permission", () =>
    session.erProgram.methods.labClosePermission().accounts(permissionAccounts).transaction(),
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
