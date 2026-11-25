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
import { restoreIdentity, updateFloor, useFloorStore } from "@/lib/floor-store";
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
  const wallet = useFloorStore((state) => state.wallet);
  const identity = useFloorStore((state) => state.identity);
  const session = useFloorStore((state) => state.session);
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
  useEffect(() => {
    if (!wallet || identity !== "wallet") return;
    let closed = false;
    const key = `insider.session.${wallet.publicKey.toBase58()}`;
    const restore = async () => {
      try {
        if (!localStorage.getItem(key)) return;
        updateFloor({ sessionStatus: "restoring", sessionError: null });
        const { restoreSession, sessionConfig } = await import("@/lib/session");
        const result = await restoreSession(sessionConfig(), wallet);
        if (closed) return;
        if (result) updateFloor({ session: result, sessionStatus: "on", sessionError: null });
        else {
          updateFloor({
            session: null,
            sessionStatus: "expired",
            sessionError: "Fast mode expired, turn it on again.",
          });
          useToast.getState().add("Fast mode expired, turn it on again.");
        }
      } catch (error) {
        if (!closed)
          updateFloor({
            sessionStatus: "off",
            sessionError: error instanceof Error ? error.message : "Could not restore Fast mode.",
          });
      }
    };
    void restore();
    const changed = (event: StorageEvent) => {
      if (event.key !== key) return;
      if (event.newValue === null) {
        const activeSession = useFloorStore.getState().session;
        if (activeSession?.wallet.equals(wallet.publicKey)) {
          updateFloor({ session: null, sessionStatus: "off", sessionError: null });
          useToast.getState().add("Fast mode was turned off in another tab.");
        }
      } else void restore();
    };
    window.addEventListener("storage", changed);
    return () => {
      closed = true;
      window.removeEventListener("storage", changed);
    };
  }, [wallet, identity]);
  useEffect(() => {
    if (!session) return;
    const timer = setTimeout(
      () => {
        void import("@/lib/session-routing").then(({ expireFastMode }) => {
          if (useFloorStore.getState().session?.token.equals(session.token)) {
            expireFastMode(session);
            useToast.getState().add("Fast mode expired, turn it on again.");
          }
        });
      },
      Math.max(0, session.validUntil * 1000 - Date.now() - 60_000),
    );
    return () => clearTimeout(timer);
  }, [session]);
  return (
    <>
      {children}
      {active && WalletRuntime && <WalletRuntime />}
    </>
  );
}
