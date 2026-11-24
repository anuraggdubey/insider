/**
 * soar-demo (A-4.2): a SOAR game and leaderboard on devnet fed with INSIDER season scores.
 *
 * SOAR is a separate program: the game authority (our deployer key) creates a game and a
 * leaderboard, each player signs two small transactions once (create a player account, register
 * on the leaderboard), and only the authority can submit scores. This script runs that whole flow
 * with the two simulation keys and reads the leaderboard back. It sends no INSIDER instruction.
 * Writes `docs/proofs/soar.json`; the game address is kept in `.keys/soar-game.json`.
 *
 *   pnpm soar-demo
 */
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { SoarProgram } from "@magicblock-labs/soar-sdk";
import { BN } from "@anchor-lang/core";
import { type Keypair, type Signer, type Transaction } from "@solana/web3.js";

import {
  ROOT,
  baseConnection,
  baseTxUrl,
  config as baseConfig,
  loadKeypair,
  loadOrCreateKeypair,
  sendTx,
} from "@insider/sdk/node";

// `const enum`s of the SOAR SDK: Genre.Casual and GameType.Web
const GENRE_CASUAL = 5 as never;
const GAME_TYPE_WEB = 2 as never;

async function main() {
  const authority = loadKeypair(baseConfig.walletPath);
  const connection = baseConnection(baseConfig);
  const soar = SoarProgram.getFromConnection(connection, authority.publicKey);
  const game = loadOrCreateKeypair(resolve(ROOT, ".keys/soar-game.json"));
  const players: Array<{ name: string; key: Keypair }> = [
    { name: "bob", key: loadOrCreateKeypair(resolve(ROOT, ".keys/sim/bob.json")) },
    { name: "carol", key: loadOrCreateKeypair(resolve(ROOT, ".keys/sim/carol.json")) },
    // the bots and the analysts register too, so a season publish lists them
    ...readdirSync(resolve(ROOT, ".keys/agents"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => ({
        name: file.replace(/.json$/, ""),
        key: loadKeypair(resolve(ROOT, ".keys/agents", file)),
      })),
  ];
  const steps: Array<{ what: string; signature?: string; url?: string }> = [];
  const send = async (what: string, tx: Transaction, signers: Signer[]) => {
    const { signature } = await sendTx(connection, tx, signers as Keypair[], {
      feePayer: authority,
    });
    const url = baseTxUrl(signature);
    console.log(`${what}\n    ${url}`);
    steps.push({ what, signature, url });
  };
  const exists = async (
    key: { toBase58(): string } & Parameters<typeof connection.getAccountInfo>[0],
  ) => Boolean(await connection.getAccountInfo(key));

  // 1. the game, once
  if (!(await exists(game.publicKey))) {
    const created = await soar.initializeNewGame(
      game.publicKey,
      "INSIDER",
      "A real-time front-running game on Solana",
      GENRE_CASUAL,
      GAME_TYPE_WEB,
      authority.publicKey,
      [authority.publicKey],
    );
    await send("create the SOAR game", created.transaction, [authority, game]);
  }

  // 2. the leaderboard, once (the game account lists it)
  const account = await soar.fetchGameAccount(game.publicKey);
  let leaderboard = soar.utils.deriveLeaderBoardAddress(
    account.leaderboardCount,
    game.publicKey,
  )[0];
  if (account.leaderboardCount.isZero()) {
    const board = await soar.addNewGameLeaderBoard(
      game.publicKey,
      authority.publicKey,
      "INSIDER season score",
      authority.publicKey,
      10,
      false,
      0,
      new BN(0),
      new BN("1000000000000"),
      true,
    );
    await send("add the leaderboard", board.transaction, [authority]);
    leaderboard = board.newLeaderBoard;
  }

  // scores are never negative here (a season below zero is published as 0): fix a board made with other bounds
  const current = await soar.fetchLeaderBoardAccount(leaderboard);
  if (!current.minScore.isZero() || current.maxScore.lt(new BN("1000000000000"))) {
    const fixed = await soar.updateGameLeaderboard(
      authority.publicKey,
      leaderboard,
      current.description,
      undefined,
      new BN(0),
      new BN("1000000000000"),
    );
    await send("set the score bounds to 0..1e12", fixed.transaction, [authority]);
  }

  // 3. each player signs twice, once
  for (const { name, key } of players) {
    const [account] = soar.utils.derivePlayerAddress(key.publicKey);
    if (!(await exists(account))) {
      const created = await soar.initializePlayerAccount(
        key.publicKey,
        `insider-${name}`,
        authority.publicKey,
      );
      await send(`${name} creates a player account`, created.transaction, [authority, key]);
    }
    const [list] = soar.utils.derivePlayerScoresListAddress(key.publicKey, leaderboard);
    if (!(await exists(list))) {
      const entry = await soar.registerPlayerEntryForLeaderBoard(key.publicKey, leaderboard);
      await send(`${name} registers on the leaderboard`, entry.transaction, [authority, key]);
    }
  }

  // 4. only the authority submits scores
  const scores = [
    // only the two simulation players get a demo score
    { name: "bob", score: 1_240 },
    { name: "carol", score: 860 },
  ];
  for (const { name, score } of scores) {
    const key = players.find((p) => p.name === name)!.key;
    const submitted = await soar.submitScoreToLeaderBoard(
      key.publicKey,
      authority.publicKey,
      leaderboard,
      new BN(score),
    );
    await send(`submit ${name}: ${score}`, submitted.transaction, [authority]);
  }

  // 5. a player cannot submit their own score
  let selfSubmitRefused = false;
  try {
    const own = await soar.submitScoreToLeaderBoard(
      players[1]!.key.publicKey,
      players[1]!.key.publicKey,
      leaderboard,
      new BN(999_999),
    );
    await sendTx(connection, own.transaction, [authority, players[1]!.key], {
      feePayer: authority,
    });
  } catch {
    selfSubmitRefused = true;
  }

  // 6. read it back
  const board = await soar.fetchLeaderBoardAccount(leaderboard);
  const top = board.topEntries
    ? await soar.fetchLeaderBoardTopEntriesAccount(board.topEntries)
    : undefined;
  const entries = (top?.topScores ?? []).map((e) => ({
    player: e.player.toBase58(),
    score: e.entry.score.toString(),
  }));
  console.log("\nleaderboard", JSON.stringify(entries));
  const checks = [
    {
      name: "the leaderboard lists both players, best first",
      pass: entries.length >= 2 && Number(entries[0]!.score) >= Number(entries[1]!.score),
    },
    { name: "a player cannot submit their own score", pass: selfSubmitRefused },
  ];
  for (const check of checks) console.log(`  ${check.pass ? "PASS" : "FAIL"}  ${check.name}`);
  const out = resolve(ROOT, "docs/proofs/soar.json");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(
    out,
    `${JSON.stringify({ program: "SoarNNzwQHMwcfdkdLc6kvbkoMSxcHy89gTHrjhJYkk", game: game.publicKey.toBase58(), leaderboard: leaderboard.toBase58(), entries, checks, steps }, null, 2)}\n`,
  );
  process.exit(checks.every((c) => c.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
