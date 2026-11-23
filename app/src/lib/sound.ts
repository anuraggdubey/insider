"use client";

import { create } from "zustand";

export type SoundCue = "order" | "priority" | "fill" | "drop" | "crack" | "sandwich";
const STORAGE_KEY = "insider.sound.v1";
export const useSoundStore = create<{ enabled: boolean }>(() => ({ enabled: false }));
let interacted = false;
let context: AudioContext | null = null;
let engine: typeof import("./sound-engine") | null = null;
let loading: Promise<typeof import("./sound-engine")> | null = null;
function loadEngine() {
  return (loading ??= import("./sound-engine")
    .then((module) => {
      engine = module;
      return module;
    })
    .catch((error: unknown) => {
      loading = null;
      throw error;
    }));
}

function audioContext() {
  if (typeof window === "undefined") return null;
  const Audio =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Audio) return null;
  try {
    if (!context || context.state === "closed") context = new Audio();
    return context;
  } catch {
    return null;
  }
}

export function initializeSound() {
  let enabled = false;
  try {
    enabled = window.localStorage.getItem(STORAGE_KEY) === "on";
  } catch {}
  useSoundStore.setState({ enabled });
  if (!enabled) engine?.stopPlaying();
}

export function setSoundEnabled(enabled: boolean) {
  useSoundStore.setState({ enabled });
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
  if (!enabled) engine?.stopPlaying();
  if (enabled && interacted) {
    const audio = audioContext();
    if (audio?.state === "suspended") void audio.resume().catch(() => {});
    void loadEngine().catch(() => {});
  }
}

export function soundGesture() {
  interacted = true;
  if (!useSoundStore.getState().enabled) return;
  const audio = audioContext();
  if (audio?.state === "suspended") void audio.resume().catch(() => {});
  void loadEngine().catch(() => {});
}

export function playSound(cue: SoundCue) {
  if (!interacted || !useSoundStore.getState().enabled) return;
  const audio = audioContext();
  if (!audio || audio.state !== "running") return;
  if (engine) engine.play(audio, cue);
  else
    void loadEngine()
      .then((loaded) => {
        if (interacted && useSoundStore.getState().enabled && audio.state === "running")
          loaded.play(audio, cue);
      })
      .catch(() => {});
}
