"use client";

import { Volume2, VolumeX } from "lucide-react";
import { useEffect } from "react";
import { initializeSound, setSoundEnabled, soundGesture, useSoundStore } from "@/lib/sound";

export function SoundButton() {
  const enabled = useSoundStore((state) => state.enabled);
  useEffect(() => {
    initializeSound();
    const gesture = (event: Event) => {
      if (event.isTrusted) soundGesture();
    };
    const storage = (event: StorageEvent) => {
      if (event.key === "insider.sound.v1") initializeSound();
    };
    window.addEventListener("pointerdown", gesture, true);
    window.addEventListener("keydown", gesture, true);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("pointerdown", gesture, true);
      window.removeEventListener("keydown", gesture, true);
      window.removeEventListener("storage", storage);
    };
  }, []);
  return (
    <button
      type="button"
      aria-label={enabled ? "Mute sound" : "Enable sound"}
      aria-pressed={enabled}
      title={enabled ? "Mute sound" : "Enable sound"}
      className="border-line-strong text-muted hover:text-text hover:border-primary bg-surface grid size-10 shrink-0 cursor-pointer place-items-center rounded-xl border-2"
      onClick={() => setSoundEnabled(!enabled)}
    >
      {enabled ? (
        <Volume2 aria-hidden className="size-4" />
      ) : (
        <VolumeX aria-hidden className="size-4" />
      )}
    </button>
  );
}
