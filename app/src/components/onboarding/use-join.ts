"use client";

import type { InsiderConfig } from "@insider/sdk";
import { useCallback } from "react";
import { useToast } from "@/components/ui/toast";
import { friendlyError } from "@/lib/errors";
import { selectGuest, updateFloor, useFloorStore } from "@/lib/floor-store";
import { createGuest } from "@/lib/guest";

/**
 * Taking a seat, shared by every join button so they all show the same "Joining…" state.
 * `seat` joins as whoever is selected; `joinAsGuest` switches to the browser key first.
 */
export function useJoin(config: InsiderConfig) {
  const joining = useFloorStore((state) => state.joining);
  const seat = useCallback(
    async (asGuest = false) => {
      if (useFloorStore.getState().joining) return;
      updateFloor({ joining: true });
      try {
        if (asGuest) selectGuest(createGuest());
        const { joinFloor } = await import("@/lib/floor-actions");
        await joinFloor(config);
      } catch (error) {
        const message = friendlyError(error);
        useToast
          .getState()
          .add(
            message.startsWith("No human seat")
              ? "All seats are taken right now. You can watch this round."
              : message,
          );
      } finally {
        updateFloor({ joining: false });
      }
    },
    [config],
  );
  const joinAsGuest = useCallback(() => seat(true), [seat]);
  return { joining, seat, joinAsGuest };
}
