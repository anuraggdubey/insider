"use client";

import { GameProvider } from "@/app/game-provider";
import { CupView } from "./cup-view";

export default function CupRuntime() {
  return (
    <GameProvider>
      <CupView />
    </GameProvider>
  );
}
