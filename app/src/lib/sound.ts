"use client";

import { create } from "zustand";

export type SoundCue = "order" | "priority" | "fill" | "drop" | "crack" | "sandwich";
type Tone = {
  frequency: number;
  end?: number;
  delay: number;
  duration: number;
  gain: number;
  type: OscillatorType;
};
const cues: Record<SoundCue, Tone[]> = {
  order: [{ frequency: 520, delay: 0, duration: 0.06, gain: 0.035, type: "sine" }],
  priority: [{ frequency: 920, delay: 0, duration: 0.09, gain: 0.04, type: "sine" }],
  fill: [
    { frequency: 620, delay: 0, duration: 0.09, gain: 0.045, type: "sine" },
    { frequency: 830, delay: 0.1, duration: 0.13, gain: 0.04, type: "sine" },
  ],
  drop: [
    { frequency: 240, delay: 0, duration: 0.24, gain: 0.045, type: "sine" },
    { frequency: 360, delay: 0.04, duration: 0.19, gain: 0.025, type: "sine" },
  ],
  crack: [
    { frequency: 460, end: 1200, delay: 0, duration: 0.25, gain: 0.025, type: "triangle" },
    { frequency: 880, end: 1450, delay: 0.08, duration: 0.21, gain: 0.02, type: "sine" },
  ],
  sandwich: [{ frequency: 105, end: 50, delay: 0, duration: 0.26, gain: 0.06, type: "sine" }],
};

const STORAGE_KEY = "insider.sound.v1";
export const useSoundStore = create<{ enabled: boolean }>(() => ({ enabled: false }));
let interacted = false;
let context: AudioContext | null = null;
const playing = new Set<OscillatorNode>();

function stopPlaying() {
  for (const oscillator of playing) {
    try {
      oscillator.stop();
    } catch {}
  }
  playing.clear();
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
  if (!enabled) stopPlaying();
}

export function setSoundEnabled(enabled: boolean) {
  useSoundStore.setState({ enabled });
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
  } catch {}
  if (!enabled) stopPlaying();
  if (enabled && interacted) {
    const audio = audioContext();
    if (audio?.state === "suspended") void audio.resume().catch(() => {});
  }
}

export function soundGesture() {
  interacted = true;
  if (!useSoundStore.getState().enabled) return;
  const audio = audioContext();
  if (audio?.state === "suspended") void audio.resume().catch(() => {});
}

export function playSound(cue: SoundCue) {
  if (!interacted || !useSoundStore.getState().enabled) return;
  const audio = audioContext();
  if (!audio || audio.state !== "running") return;
  try {
    for (const tone of cues[cue]) {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      const start = audio.currentTime + tone.delay;
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.frequency, start);
      if (tone.end)
        oscillator.frequency.exponentialRampToValueAtTime(tone.end, start + tone.duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(tone.gain, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      playing.add(oscillator);
      oscillator.onended = () => playing.delete(oscillator);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.01);
    }
  } catch {
    // Audio is optional; gameplay must remain usable if the device cannot play it.
  }
}
