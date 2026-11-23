"use client";

import type { InsiderConfig } from "@insider/sdk";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { useToast } from "@/components/ui/toast";
import { restoreIdentity } from "@/lib/floor-store";
import { activateWallet, useWalletUi } from "@/lib/wallet-ui";

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
  const active = useWalletUi((state) => state.active);
  const [WalletRuntime, setWalletRuntime] = useState<ComponentType | null>(null);
  useEffect(() => {
    restoreIdentity();
    try {
      if (JSON.parse(window.localStorage.getItem("walletName") ?? "null")) activateWallet();
    } catch {}
  }, []);
  useEffect(() => {
    if (!active || WalletRuntime) return;
    let closed = false;
    void import("@/components/onboarding/wallet-runtime")
      .then((module) => {
        if (!closed) setWalletRuntime(() => module.WalletRuntime);
      })
      .catch(() => {
        if (!closed) {
          useWalletUi.setState({ active: false, request: null, busy: false });
          useToast.getState().add("Could not load the wallet selector. Please try again.");
        }
      });
    return () => {
      closed = true;
    };
  }, [active, WalletRuntime]);
  return (
    <>
      {children}
      {active && WalletRuntime && <WalletRuntime />}
    </>
  );
}
