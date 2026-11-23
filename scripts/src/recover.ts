/**
 * Recovery for one account when the rollup is not answering (base layer, table authority):
 *
 *   pnpm recover --request  --kind xray            ask the Delegation program to undelegate it
 *   pnpm recover --rollback --kind seat --slot 4   after the request's timeout: take it back as committed
 *   pnpm recover --status   --kind cup             show the request, if any
 *
 * Kinds: table tape callBook season market cup mempool future board xray leakVault callVault seat.
 * `--slot` is the market kind (0 floor, 1 desk), the vault slot or the seat.
 */
import { Connection } from "@solana/web3.js";

import {
  RECOVERY_KIND,
  config as baseConfig,
  delegationAccounts,
  loadKeypair,
  recoveryAddress,
  requestUndelegation,
  rollbackUndelegation,
  sendTx,
  tx,
} from "@insider/sdk/node";

import { DELEGATION_PROGRAM_ID } from "./lib/config.js";

const args = process.argv.slice(2);
const value = (flag: string) => (args.includes(flag) ? args[args.indexOf(flag) + 1] : undefined);

async function main() {
  const name = value("--kind") as keyof typeof RECOVERY_KIND | undefined;
  if (!name || !(name in RECOVERY_KIND)) {
    throw new Error(`--kind must be one of: ${Object.keys(RECOVERY_KIND).join(" ")}`);
  }
  const target = { kind: RECOVERY_KIND[name], slot: Number(value("--slot") ?? 0) };
  const authority = loadKeypair(baseConfig.walletPath);
  const config = { ...baseConfig, tableAuthority: authority.publicKey };
  const base = new Connection(config.baseRpcUrl, "confirmed");
  const address = recoveryAddress(config, target);
  const info = await base.getAccountInfo(address);
  const delegated = Boolean(info?.owner.equals(DELEGATION_PROGRAM_ID));
  console.log(
    `${name} ${target.slot}: ${address.toBase58()} (${delegated ? "delegated" : "on the base layer"})`,
  );
  const request = delegationAccounts(address).undelegationRequest;
  const requestInfo = await base.getAccountInfo(request);

  if (args.includes("--status")) {
    if (!requestInfo) return console.log("no undelegation request");
    // discriminator (8), delegated account (32), the first slot at which the rollback is allowed (u64)
    const expires = Number(requestInfo.data.readBigUInt64LE(8 + 32));
    console.log(
      `request ${request.toBase58()}, rollback allowed from slot ${expires} (now ${await base.getSlot()})`,
    );
    return;
  }
  if (!delegated) throw new Error("the account is not delegated: nothing to recover");
  const build = args.includes("--rollback") ? rollbackUndelegation : requestUndelegation;
  if (!args.includes("--request") && !args.includes("--rollback")) {
    throw new Error("choose --request, --rollback or --status");
  }
  const { signature } = await sendTx(base, tx(build(config, authority.publicKey, target)), [
    authority,
  ]);
  console.log(`${args.includes("--rollback") ? "rollback" : "request"} sent: ${signature}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
