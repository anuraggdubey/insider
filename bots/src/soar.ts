/**
 * Publishes each finished season to a SOAR leaderboard (A-4.2). SOAR is a separate program: only
 * the game authority (the table authority key) may submit a score, and a player must have created
 * a SOAR player account and registered on the leaderboard once (two small wallet-signed
 * transactions, the bots and analysts do it with `pnpm soar-demo`-style scripts; humans in the
 * app). Players who have not registered are skipped. The operator calls this when a season is back
 * on the base layer and before it opens the next one; a failure never blocks `open_epoch`.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { BN } from "@anchor-lang/core";
import { SoarProgram } from "@magicblock-labs/soar-sdk";
import { type Connection, type Keypair, PublicKey } from "@solana/web3.js";

import { ROOT, loadKeypair, sendTx } from "@insider/sdk/node";

export type SeasonEntry = { owner: PublicKey; score: bigint | number | { toString(): string } };

const EMPTY = PublicKey.default.toBase58();

/** Who gets a score submitted: registered players only, never a negative score, no empty slots. */
export function planSubmissions(entries: SeasonEntry[], registered: Set<string>) {
  const submit: Array<{ owner: PublicKey; score: number }> = [];
  const skipped: string[] = [];
  for (const entry of entries) {
    const key = entry.owner.toBase58();
    if (key === EMPTY) continue;
    if (!registered.has(key)) {
      skipped.push(key);
      continue;
    }
    const raw = Number(entry.score.toString());
    submit.push({ owner: entry.owner, score: Math.max(0, Math.round(raw)) });
  }
  return { submit, skipped };
}

type Published = { epochs: number[] };

export class SoarPublisher {
  private constructor(
    private readonly soar: SoarProgram,
    private readonly connection: Connection,
    private readonly authority: Keypair,
    readonly game: PublicKey,
    private readonly statePath: string,
  ) {}

  /** `undefined` when no SOAR game has been created (no `.keys/soar-game.json`): publishing is off. */
  static open(connection: Connection, authority: Keypair, root = ROOT): SoarPublisher | undefined {
    const gamePath = resolve(root, ".keys/soar-game.json");
    if (!existsSync(gamePath)) return undefined;
    const game = loadKeypair(gamePath).publicKey;
    return new SoarPublisher(
      SoarProgram.getFromConnection(connection, authority.publicKey),
      connection,
      authority,
      game,
      resolve(root, ".keys/soar-published.json"),
    );
  }

  private published(): Published {
    try {
      return JSON.parse(readFileSync(this.statePath, "utf8")) as Published;
    } catch {
      return { epochs: [] };
    }
  }

  alreadyPublished(epoch: number) {
    return this.published().epochs.includes(epoch);
  }

  /** Submits the season's scores once per epoch. Returns what was sent and who was skipped. */
  async publish(epoch: number, entries: SeasonEntry[]) {
    const account = await this.soar.fetchGameAccount(this.game);
    if (account.leaderboardCount.isZero()) throw new Error("the SOAR game has no leaderboard");
    const leaderboard = this.soar.utils.deriveLeaderBoardAddress(
      account.leaderboardCount,
      this.game,
    )[0];
    const lists = entries.map(
      (entry) => this.soar.utils.derivePlayerScoresListAddress(entry.owner, leaderboard)[0],
    );
    const infos = await this.connection.getMultipleAccountsInfo(lists);
    const registered = new Set(
      entries.filter((_, i) => infos[i]).map((entry) => entry.owner.toBase58()),
    );
    const { submit, skipped } = planSubmissions(entries, registered);
    for (const { owner, score } of submit) {
      const result = await this.soar.submitScoreToLeaderBoard(
        owner,
        this.authority.publicKey,
        leaderboard,
        new BN(score),
      );
      await sendTx(this.connection, result.transaction, [this.authority], {
        feePayer: this.authority,
      });
    }
    const state = this.published();
    writeFileSync(this.statePath, JSON.stringify({ epochs: [...state.epochs, epoch].slice(-200) }));
    return { submitted: submit.length, skipped };
  }
}
