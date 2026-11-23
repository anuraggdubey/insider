import { BN, BorshAccountsCoder, convertIdlToCamelCase, type Idl } from "@anchor-lang/core";
import { createConfig, decodeSeason, tableAccounts } from "@insider/sdk";
import { type Connection, Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, it, vi } from "vitest";
import { deriveSeason, fetchSeason, shortKey } from "../../app/src/lib/season";
import { fixtureSeason } from "../../app/src/lib/season-fixture";
import idl from "../../programs/idl/insider.json";

const coder = new BorshAccountsCoder(convertIdlToCamelCase(idl as Idl));
function encodeSeason(season: ReturnType<typeof fixtureSeason>["season"]) {
  const data = Buffer.alloc(1057);
  Buffer.from(idl.accounts.find((account) => account.name === "Season")!.discriminator).copy(data);
  let offset = 8;
  data.writeUInt32LE(season.epoch, offset);
  offset += 4;
  data.writeUInt32LE(season.roundsPlayed, offset);
  offset += 4;
  for (const entry of season.leaderboard) {
    entry.owner.toBuffer().copy(data, offset);
    offset += 32;
    data.writeBigInt64LE(BigInt(entry.score.toString()), offset);
    offset += 8;
    data.writeUInt16LE(entry.rounds, offset);
    offset += 2;
  }
  for (const stats of season.analysts) {
    data.writeUInt32LE(stats.calls, offset);
    offset += 4;
    data.writeUInt32LE(stats.hits, offset);
    offset += 4;
    data.writeUInt16LE(stats.streak, offset);
    offset += 2;
    data.writeUInt16LE(stats.bestStreak, offset);
    offset += 2;
    data.writeBigInt64LE(BigInt(stats.profit.toString()), offset);
    offset += 8;
  }
  data.writeUInt8(season.bump, offset++);
  expect(offset).toBe(data.length);
  return data;
}

describe("season account and view", () => {
  it("decodes the account and derives names, both identities, signed scores and analyst stats", async () => {
    const fixture = fixtureSeason();
    const guest = fixture.seats[4]!.owner;
    const wallet = fixture.season.leaderboard[2]!.owner;
    fixture.season.leaderboard[0]!.score = new BN("9007199254740993");
    fixture.season.analysts[5]!.profit = new BN("-9007199254740995");
    const encoded = encodeSeason(fixture.season);
    const season = decodeSeason(encoded);
    const view = deriveSeason({ season, seats: fixture.seats }, [guest, wallet]);
    expect([view.epoch, view.roundsPlayed]).toEqual([4, 24]);
    expect(view.leaderboard).toHaveLength(7);
    expect(view.leaderboard[0]).toMatchObject({
      rank: 1,
      name: "Amber Wolf",
      score: 9007199254740993n,
      rounds: 18,
      isYou: true,
    });
    expect(view.leaderboard[2]).toMatchObject({ name: shortKey(wallet), isYou: true });
    expect(view.analysts).toHaveLength(10);
    expect(view.analysts[5]).toMatchObject({
      name: "Calm Raven",
      calls: 31,
      hits: 20,
      streak: 3,
      bestStreak: 7,
      profit: -9007199254740995n,
    });
    expect(view.analysts[7]!.name).toBe("Seat 8");
    expect(season.leaderboard[19]!.owner.equals(PublicKey.default)).toBe(true);
  });

  it("reads the Season and current seat accounts independently of the floor snapshot", async () => {
    const fixture = fixtureSeason();
    const config = createConfig({ tableAuthority: Keypair.generate().publicKey });
    const season = encodeSeason(fixture.season);
    const seats = await Promise.all(fixture.seats.map((seat) => coder.encode("seat", seat!)));
    const accounts = [{ data: season }, ...seats.map((data) => ({ data }))];
    const getMultipleAccountsInfo = vi.fn().mockResolvedValue(accounts);
    const rpc = { getMultipleAccountsInfo } as unknown as Connection;
    const fetched = await fetchSeason(rpc, config);
    expect(fetched?.season.roundsPlayed).toBe(24);
    expect(fetched?.seats[4]?.owner.equals(fixture.seats[4]!.owner)).toBe(true);
    const addresses = tableAccounts(config.tableAuthority!, config.programId);
    expect(rpc.getMultipleAccountsInfo).toHaveBeenCalledWith(
      [addresses.season, ...addresses.seats],
      "confirmed",
    );
    getMultipleAccountsInfo.mockResolvedValue([null, ...accounts.slice(1)]);
    expect(await fetchSeason(rpc, config)).toBeNull();
    expect(await fetchSeason(rpc, createConfig())).toBeNull();
  });
});
