import {
  AnchorProvider,
  Program,
  Wallet,
  type Idl,
  type Wallet as AnchorWallet,
} from "@anchor-lang/core";
import { type Connection, Keypair, type PublicKey } from "@solana/web3.js";
import idl from "../../programs/idl/insider.json" with { type: "json" };
import { createConfig } from "#config";
import type { Insider } from "#idl";

export type { Insider } from "#idl";

export function insiderProgram(
  connection: Connection,
  wallet: Keypair | AnchorWallet,
  programId?: PublicKey,
) {
  const anchorWallet = wallet instanceof Keypair ? new Wallet(wallet) : wallet;
  return new Program<Insider>(
    { ...(idl as Idl), address: (programId ?? createConfig().programId).toBase58() } as Insider,
    new AnchorProvider(connection, anchorWallet, {}),
  );
}
