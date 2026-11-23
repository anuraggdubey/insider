"use client";

import { createConfig, type InsiderConfig } from "@insider/sdk";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

const InsiderContext = createContext<InsiderConfig | null>(null);

export function useInsider() {
  const value = useContext(InsiderContext);
  if (!value) throw new Error("useInsider must be used within InsiderProvider");
  return value;
}

export function InsiderProvider({
  config,
  children,
}: {
  config: InsiderConfig;
  children: ReactNode;
}) {
  return <InsiderContext.Provider value={config}>{children}</InsiderContext.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
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
  const wallets = useMemo(() => [], []);
  return (
    <QueryClientProvider client={queryClient}>
      <ConnectionProvider endpoint={config.baseRpcUrl}>
        <WalletProvider wallets={wallets} autoConnect={false}>
          <WalletModalProvider>
            <InsiderProvider config={config}>{children}</InsiderProvider>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </QueryClientProvider>
  );
}
