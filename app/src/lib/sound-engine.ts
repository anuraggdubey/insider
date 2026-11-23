import type { SoundCue } from "./sound";

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
const playing = new Set<OscillatorNode>();

export function stopPlaying() {
  for (const oscillator of playing) {
    try {
      oscillator.stop();
    } catch {}
  }
  playing.clear();
}

export function play(audio: AudioContext, cue: SoundCue) {
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
  } catch {}
}
