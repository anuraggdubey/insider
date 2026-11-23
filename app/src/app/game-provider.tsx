"use client";

import { createConfig } from "@insider/sdk/config";
import { PublicKey } from "@solana/web3.js";
import { useMemo, type ReactNode } from "react";
import { InsiderProvider } from "./providers";

export function GameProvider({ children }: { children: ReactNode }) {
  const config = useMemo(
    () =>
      createConfig({
        baseRpcUrl: process.env.NEXT_PUBLIC_SOLANA_RPC_URL || undefined,
        routerUrl: process.env.NEXT_PUBLIC_MAGIC_ROUTER_URL || undefined,
        routerWsUrl: process.env.NEXT_PUBLIC_MAGIC_ROUTER_WS_URL || undefined,
        teeRpcUrl: process.env.NEXT_PUBLIC_TEE_RPC_URL || undefined,
        programId: process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID
          ? new PublicKey(process.env.NEXT_PUBLIC_INSIDER_PROGRAM_ID)
          : undefined,
        tableAuthority: process.env.NEXT_PUBLIC_TABLE_AUTHORITY
          ? new PublicKey(process.env.NEXT_PUBLIC_TABLE_AUTHORITY)
          : undefined,
      }),
    [],
  );
  return <InsiderProvider config={config}>{children}</InsiderProvider>;
}
