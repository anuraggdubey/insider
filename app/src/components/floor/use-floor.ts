"use client";

import type { InsiderConfig } from "@insider/sdk";
import { useEffect } from "react";
import { publishFixture, updateFloor, useFloorStore } from "@/lib/floor-store";
import { loadGuest } from "@/lib/guest";
import { createRoundObserver } from "@/lib/xray-archive";
import { useToast } from "@/components/ui/toast";

export function useFloor(config: InsiderConfig, fixtureMode: boolean) {
  useEffect(() => {
    const existingFixture = fixtureMode ? useFloorStore.getState().fixture : null;
    const observe = createRoundObserver(fixtureMode);
    updateFloor({
      status: "loading",
      snapshot: null,
      fixture: null,
      pending: [],
      vaults: {},
      error: null,
    });
    try {
      updateFloor({ guest: loadGuest() });
    } catch (error) {
      updateFloor({
        error: error instanceof Error ? error.message : "Could not load the guest key.",
      });
    }
    let closed = false;
    let unsubscribe = () => {};
    let interval: ReturnType<typeof setInterval> | undefined;
    let reconnect: ReturnType<typeof setTimeout> | undefined;
    if (fixtureMode && process.env.NODE_ENV !== "production") {
      void import("@/lib/fixture")
        .then(({ createFixture, fixtureTick }) => {
          if (closed) return;
          const fixture = existingFixture ?? createFixture();
          observe(fixture.snapshot);
          publishFixture(fixture);
          interval = setInterval(() => {
            const state = useFloorStore.getState();
            fixtureTick(fixture);
            observe(fixture.snapshot);
            publishFixture(fixture);
            updateFloor({
              pending: state.pending.filter(
                (order) => order.landTick > fixture.snapshot.table.tick,
              ),
            });
          }, 500);
        })
        .catch((error: unknown) => {
          if (!closed)
            updateFloor({
              status: "offline",
              error: error instanceof Error ? error.message : "Could not load the fixture.",
            });
        });
    } else if (!config.tableAuthority) {
      updateFloor({ status: "offline" });
    } else {
      const connect = async () => {
        try {
          const [{ teeConnection }, { fetchTable, subscribeTable }] = await Promise.all([
            import("@insider/sdk/connection"),
            import("@insider/sdk/accounts"),
          ]);
          const connection = await teeConnection(config);
          const snapshot = await fetchTable(connection, config);
          if (closed) return;
          if (!snapshot) {
            updateFloor({ status: "offline", snapshot: null });
            return;
          }
          observe(snapshot);
          updateFloor({ snapshot, status: "live", error: null });
          unsubscribe = subscribeTable(
            connection,
            config,
            (next) => {
              if (!next) updateFloor({ status: "offline", snapshot: null });
              else {
                observe(next);
                updateFloor({ snapshot: next, status: "live" });
              }
            },
            () => {
              if (!closed) {
                unsubscribe();
                updateFloor({ status: "reconnecting" });
                reconnect = setTimeout(connect, 3_000);
              }
            },
          );
        } catch (error) {
          if (!closed) {
            updateFloor({
              status: "reconnecting",
              error: error instanceof Error ? error.message : "Could not connect to the TEE.",
            });
            reconnect = setTimeout(connect, 3_000);
          }
        }
      };
      void connect();
    }
    return () => {
      closed = true;
      unsubscribe();
      if (interval) clearInterval(interval);
      if (reconnect) clearTimeout(reconnect);
    };
  }, [config, fixtureMode]);

  useEffect(() => {
    const timer = setInterval(() => {
      const state = useFloorStore.getState();
      if (
        (document.visibilityState === "visible" ||
          (state.identity === "wallet" && state.session)) &&
        state.snapshot &&
        ((state.identity === "guest" && state.guest) ||
          (state.identity === "wallet" && state.wallet && state.session)) &&
        !state.fixture
      )
        void import("@/lib/floor-actions")
          .then(({ keepSeatAlive }) => keepSeatAlive(config))
          .catch((error: unknown) => {
            if (error instanceof Error && error.message.includes("Fast mode expired"))
              useToast.getState().add(error.message);
          });
    }, 20_000);
    return () => clearInterval(timer);
  }, [config]);
}
