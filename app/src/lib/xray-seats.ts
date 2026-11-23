import { seatName } from "@insider/sdk/names";
import { PublicKey } from "@solana/web3.js";
import type { ArchivedSeat } from "./xray-archive";

export function seatsFromXray(xray: {
  seatOwners: readonly (PublicKey | string)[];
  scores: readonly number[];
  seatKinds: readonly number[];
  nameIdx: readonly number[];
}): ArchivedSeat[] {
  const freeOwner = PublicKey.default.toBase58();
  return xray.seatOwners.map((key, index) => {
    const owner = typeof key === "string" ? key : key.toBase58();
    return {
      index,
      owner,
      score: xray.scores[index]!,
      free: owner === freeOwner,
      kind: ["bot", "ai", "human"][xray.seatKinds[index]!] ?? "unknown",
      name: seatName(xray.nameIdx[index]!),
    };
  });
}
