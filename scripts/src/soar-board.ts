/** Prints the SOAR leaderboard the operator publishes to (read only): `pnpm soar-board`. */
import { resolve } from "node:path";

import { SoarProgram } from "@magicblock-labs/soar-sdk";

import { ROOT, baseConnection, config, loadKeypair } from "@insider/sdk/node";

const connection = baseConnection(config);
const game = loadKeypair(resolve(ROOT, ".keys/soar-game.json")).publicKey;
const soar = SoarProgram.getFromConnection(connection, loadKeypair(config.walletPath).publicKey);
const account = await soar.fetchGameAccount(game);
const board = soar.utils.deriveLeaderBoardAddress(account.leaderboardCount, game)[0];
const leaderboard = await soar.fetchLeaderBoardAccount(board);
const top = leaderboard.topEntries
  ? await soar.fetchLeaderBoardTopEntriesAccount(leaderboard.topEntries)
  : undefined;
console.log(`game ${game.toBase58()}\nleaderboard ${board.toBase58()}`);
for (const entry of top?.topScores ?? []) {
  if (
    entry.entry.score.isZero() &&
    entry.player.equals(entry.player) &&
    entry.entry.timestamp.isZero()
  )
    continue;
  console.log(`${entry.player.toBase58()}  ${entry.entry.score.toString()}`);
}
process.exit(0);
