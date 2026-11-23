import { PublicKey } from "@solana/web3.js";

export const DELEGATION_PROGRAM_ID = new PublicKey("DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh");
export const MAGIC_PROGRAM_ID = new PublicKey("Magic11111111111111111111111111111111111111");
export const MAGIC_CONTEXT_ID = new PublicKey("MagicContext1111111111111111111111111111111");
export const PERMISSION_PROGRAM_ID = new PublicKey("ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1");
export const EPHEMERAL_VRF_QUEUE = new PublicKey("5hBR571xnXppuCPveTrctfTU7tJLSN94nq7kv7FRK5Tc");
export const VALIDATORS = {
  er: new PublicKey("MAS1Dt9qreoRMQ14YQuhg8UTZMMzDdKhmkZMECCzk57"),
  tee: new PublicKey("MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo"),
} as const;

export type InsiderConfig = {
  baseRpcUrl: string;
  routerUrl: string;
  routerWsUrl: string;
  teeRpcUrl: string;
  programId: PublicKey;
  teeValidator: PublicKey;
  tableAuthority?: PublicKey;
};

export function createConfig(partial: Partial<InsiderConfig> = {}): InsiderConfig {
  return {
    baseRpcUrl: partial.baseRpcUrl ?? "https://api.devnet.solana.com",
    routerUrl: partial.routerUrl ?? "https://devnet-router.magicblock.app",
    routerWsUrl: partial.routerWsUrl ?? "wss://devnet-router.magicblock.app",
    teeRpcUrl: partial.teeRpcUrl ?? "https://devnet-tee.magicblock.app",
    programId: partial.programId ?? new PublicKey("7mTtHsFMYnZRnhd3SRzhj8Nm1U2T3s33dnbJwa9zBErW"),
    teeValidator: partial.teeValidator ?? VALIDATORS.tee,
    tableAuthority: partial.tableAuthority,
  };
}
