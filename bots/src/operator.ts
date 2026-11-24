/**
 * The operator: the one job that needs the table authority's key. When an epoch has been committed
 * (`commit_epoch`, which any bot sends) the season is back on the base layer; this service starts
 * the next season and delegates it again (`open_epoch`). It only reads and waits otherwise.
 *
 *   pnpm operator
 */
import { resolve } from "node:path";

import { Connection } from "@solana/web3.js";
import pino from "pino";

import { SoarPublisher } from "./soar.js";

import {
  ROOT,
  VALIDATORS,
  config as sdkConfig,
  decodeSeason,
  decodeTable,
  insiderProgram,
  loadKeypair,
  shouldOpenEpoch,
  sleep,
  tableAccounts,
  teeAuthUrl,
} from "@insider/sdk/node";

const log = pino({ level: process.env.LOG_LEVEL || "info" });

async function main() {
  const authority = loadKeypair(resolve(ROOT, process.env.ANCHOR_WALLET || ".keys/deployer.json"));
  const config = { ...sdkConfig, tableAuthority: authority.publicKey };
  const accounts = tableAccounts(authority.publicKey, config.programId);
  const base = new Connection(config.baseRpcUrl, "confirmed");
  const program = insiderProgram(base, authority, config.programId);
  const soar = SoarPublisher.open(base, authority);
  const soarTries = new Map<number, number>();
  log.info(
    { authority: authority.publicKey.toBase58(), soarGame: soar?.game.toBase58() ?? "off" },
    "operator started",
  );

  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));
  while (!stopping) {
    try {
      const rollup = new Connection(
        (await teeAuthUrl(config.teeRpcUrl, authority)).url,
        "confirmed",
      );
      const [tableInfo, seasonInfo] = await Promise.all([
        rollup.getAccountInfo(accounts.table),
        base.getAccountInfo(accounts.season),
      ]);
      if (tableInfo && seasonInfo) {
        const tableEpoch = decodeTable(tableInfo.data).epoch;
        const ownedByProgram = seasonInfo.owner.equals(config.programId);
        const seasonEpoch = ownedByProgram ? decodeSeason(seasonInfo.data).epoch : tableEpoch;
        // the season is on the base layer and not reset yet: publish it to SOAR first. Two tries
        // per epoch, then the game goes on without it.
        if (soar && ownedByProgram && !soar.alreadyPublished(seasonEpoch)) {
          const tries = soarTries.get(seasonEpoch) ?? 0;
          if (tries < 2) {
            soarTries.set(seasonEpoch, tries + 1);
            try {
              const season = decodeSeason(seasonInfo.data);
              const result = await soar.publish(seasonEpoch, season.leaderboard);
              log.info({ epoch: seasonEpoch, ...result }, "season published to SOAR");
            } catch (error) {
              log.warn(
                { epoch: seasonEpoch, error: String(error).slice(0, 200) },
                "SOAR publish failed",
              );
            }
          }
        }
        if (shouldOpenEpoch(ownedByProgram, tableEpoch, seasonEpoch)) {
          const signature = await program.methods
            .openEpoch()
            .accounts({ payer: authority.publicKey })
            .remainingAccounts([{ pubkey: VALIDATORS.tee, isSigner: false, isWritable: false }])
            .rpc({ commitment: "confirmed" });
          log.info({ signature, epoch: tableEpoch }, "open_epoch: the next season is delegated");
        }
      }
    } catch (error) {
      log.warn({ error: String(error).slice(0, 200) }, "operator step failed");
    }
    await sleep(4_000);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
