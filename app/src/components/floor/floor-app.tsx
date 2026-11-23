"use client";

import { GameProvider } from "@/app/game-provider";
import { Floor } from "./floor";

export function FloorApp() {
  return (
    <GameProvider>
      <Floor />
    </GameProvider>
  );
}
