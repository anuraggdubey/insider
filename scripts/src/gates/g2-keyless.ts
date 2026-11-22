/**
 * G2 Keyless reader: is an account private when its only member is a keyless PDA (or when the
 * member list is empty), and can program code still write to it? Used for `Mempool`, `Future`
 * and sealed Leak vaults.
 */
import { Connection } from "@solana/web3.js";

import {
  FLAGS,
  Gate,
  NOBODY,
  type Member,
  closePermission,
  connect,
  context,
  delegateProbe,
  gateKey,
  readProbe,
  resetProbe,
  runIfMain,
  send,
  setPermission,
  undelegateProbe,
} from "./lib.js";

export async function run() {
  const gate = new Gate("G2", "Keyless reader");
  const ctx = context(gate);
  const keyB = gateKey("b");
  await resetProbe(ctx);
  const session = await delegateProbe(ctx, "tee");

  const readers = [
    { name: "payer (authority)", connection: session.er },
    { name: "B (other key)", connection: (await connect(ctx, session.endpoint, keyB)).er },
    { name: "anonymous", connection: new Connection(session.endpoint, "confirmed") },
  ];

  const modes: Array<{ name: string; members: Member[] }> = [
    { name: "members = [nobody PDA]", members: [{ flags: FLAGS.AUTHORITY, pubkey: NOBODY }] },
    { name: "members = []", members: [] },
  ];

  let created = false;
  let secret = 100;
  const verdicts: Record<string, unknown> = {};
  let failures = 0;
  for (const mode of modes) {
    await setPermission(
      ctx,
      session,
      created ? "update" : "create",
      true,
      mode.members,
      `probe_permission_${created ? "update" : "create"} (${mode.name})`,
    );
    created = true;
    secret += 1;
    // program code writes into the private account through a normal signed instruction
    await send(
      gate,
      session.er,
      await session.erProgram.methods
        .probeSendSecret(secret)
        .accounts({ sender: ctx.payer.publicKey, probe: ctx.probe })
        .transaction(),
      [ctx.payer],
      `probe_send_secret ${secret} (${mode.name})`,
      "TEE",
      session.endpoint,
    );
    const reads: Record<string, string> = {};
    for (const reader of readers) {
      const state = await readProbe(reader.connection, session.erProgram, ctx.probe).catch(
        () => undefined,
      );
      const seen = state ? `readable (secret ${state.secret})` : "not returned";
      reads[reader.name] = seen;
      if (state) failures++;
    }
    verdicts[mode.name] = reads;
  }
  gate.note("reads", verdicts);

  // make it public again: the write that happened while unreadable must be there
  await setPermission(ctx, session, "update", false, [], "probe_permission_update (public)");
  const after = await readProbe(session.er, session.erProgram, ctx.probe);
  gate.note("secretAfterPublic", after?.secret ?? null);
  const writesLanded = after?.secret === secret;
  gate.note("programWritesLandedWhileUnreadable", writesLanded);

  await closePermission(ctx, session);
  await undelegateProbe(ctx, session);

  const unreadableKeyless = Object.values(verdicts[modes[0]!.name] as Record<string, string>).every(
    (v) => v === "not returned",
  );
  const unreadableEmpty = Object.values(verdicts[modes[1]!.name] as Record<string, string>).every(
    (v) => v === "not returned",
  );
  if (failures === 0 && writesLanded) {
    return gate.finish(
      "pass",
      "Both a keyless-PDA member list and an empty list make the account unreadable to everyone, including the authority, while program code keeps writing. Use [nobody] for Mempool, Future and sealed vaults.",
    );
  }
  if (unreadableEmpty && !unreadableKeyless) {
    return gate.finish(
      "info",
      "Only the empty member list hides the account: use it instead of the nobody PDA.",
    );
  }
  return gate.finish(
    "error",
    `Unexpected result (reads leaked: ${failures}, writes landed: ${writesLanded}); see facts.`,
  );
}

runIfMain(import.meta.url, run);
