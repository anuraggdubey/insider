"use client";

import { fetchTable, subscribeTable, teeConnection, type InsiderConfig } from "@insider/sdk";
import { useEffect } from "react";
import { createFixture, fixtureTick } from "@/lib/fixture";
import { keepSeatAlive } from "@/lib/floor-actions";
import { publishFixture, updateFloor, useFloorStore } from "@/lib/floor-store";
import { loadGuest } from "@/lib/guest";

export function useFloor(config: InsiderConfig, fixtureMode: boolean) {
  useEffect(() => {
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
      const fixture = createFixture();
      publishFixture(fixture);
      interval = setInterval(() => {
        const state = useFloorStore.getState();
        fixtureTick(fixture);
        publishFixture(fixture);
        updateFloor({
          pending: state.pending.filter((order) => order.landTick > fixture.snapshot.table.tick),
        });
      }, 500);
    } else if (!config.tableAuthority) {
      updateFloor({ status: "offline" });
    } else {
      const connect = async () => {
        try {
          const connection = await teeConnection(config);
          const snapshot = await fetchTable(connection, config);
          if (closed) return;
          if (!snapshot) {
            updateFloor({ status: "offline", snapshot: null });
            return;
          }
          updateFloor({ snapshot, status: "live", error: null });
          unsubscribe = subscribeTable(
            connection,
            config,
            (next) => {
              if (!next) updateFloor({ status: "offline", snapshot: null });
              else updateFloor({ snapshot: next, status: "live" });
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
      if (document.visibilityState === "visible") void keepSeatAlive(config).catch(() => {});
    }, 20_000);
    return () => clearInterval(timer);
  }, [config]);
}
