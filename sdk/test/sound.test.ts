import { afterEach, describe, expect, it, vi } from "vitest";
import { createFixture } from "../../app/src/lib/fixture";
import { crossedSandwich, floorSoundEvents } from "../../app/src/lib/sound-events";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("sound cues", () => {
  it("is muted by default, requires a gesture, persists preference, and stops on mute", async () => {
    const storage = new Map<string, string>();
    const oscillators: {
      start: ReturnType<typeof vi.fn>;
      stop: ReturnType<typeof vi.fn>;
      frequency: {
        setValueAtTime: ReturnType<typeof vi.fn>;
        exponentialRampToValueAtTime: ReturnType<typeof vi.fn>;
      };
      type: string;
      connect: ReturnType<typeof vi.fn>;
    }[] = [];
    const gain = () => ({
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
    });
    const constructor = vi.fn(function () {
      return {
        state: "running",
        currentTime: 0,
        destination: {},
        resume: vi.fn().mockResolvedValue(undefined),
        createGain: gain,
        createOscillator: () => {
          const oscillator = {
            type: "",
            frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
            start: vi.fn(),
            stop: vi.fn(),
          };
          oscillators.push(oscillator);
          return oscillator;
        },
      };
    });
    vi.stubGlobal("window", {
      AudioContext: constructor,
      localStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    });
    const sound = await import("../../app/src/lib/sound");
    sound.initializeSound();
    sound.playSound("order");
    expect(constructor).not.toHaveBeenCalled();
    sound.setSoundEnabled(true);
    expect(storage.get("insider.sound.v1")).toBe("on");
    sound.playSound("order");
    expect(constructor).not.toHaveBeenCalled();
    sound.soundGesture();
    for (const cue of ["order", "priority", "fill", "drop", "crack", "sandwich"] as const)
      sound.playSound(cue);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(oscillators).toHaveLength(9);
    expect(oscillators.map((osc) => osc.frequency.setValueAtTime.mock.calls[0]![0])).toEqual([
      520, 920, 620, 830, 240, 360, 460, 880, 105,
    ]);
    sound.setSoundEnabled(false);
    expect(storage.get("insider.sound.v1")).toBe("off");
    expect(oscillators.every((osc) => osc.stop.mock.calls.length === 2)).toBe(true);
    sound.playSound("fill");
    expect(oscillators).toHaveLength(9);
  });

  it("restores an unmuted preference without playing before a new page gesture", async () => {
    const constructor = vi.fn();
    vi.stubGlobal("window", {
      AudioContext: constructor,
      localStorage: { getItem: () => "on", setItem: vi.fn() },
    });
    const sound = await import("../../app/src/lib/sound");
    sound.initializeSound();
    expect(sound.useSoundStore.getState().enabled).toBe(true);
    sound.playSound("drop");
    expect(constructor).not.toHaveBeenCalled();
  });

  it("signals only new drops and the player's new fills, including ring wrap", () => {
    const snapshot = createFixture().snapshot;
    let result = floorSoundEvents(null, snapshot, 7);
    expect([result.drop, result.fill]).toEqual([false, false]);
    snapshot.board.headers[0]!.state = 1;
    snapshot.board.headers[0]!.leakId = 9;
    snapshot.tape.fills[0]!.seat = 7;
    snapshot.tape.fillsHead = 1;
    result = floorSoundEvents(result.next, snapshot, 7);
    expect([result.drop, result.fill]).toEqual([true, true]);
    result = floorSoundEvents(result.next, snapshot, 7);
    expect([result.drop, result.fill]).toEqual([false, false]);
    snapshot.tape.fills[1]!.seat = 3;
    snapshot.tape.fillsHead = 2;
    result = floorSoundEvents(result.next, snapshot, 7);
    expect(result.fill).toBe(false);
    result.next.fillsHead = 0xffffffff;
    snapshot.tape.fills[63]!.seat = 7;
    snapshot.tape.fillsHead = 0;
    result = floorSoundEvents(result.next, snapshot, 7);
    expect(result.fill).toBe(true);
    snapshot.table.roundId++;
    expect(floorSoundEvents(result.next, snapshot, 7)).toMatchObject({ drop: false, fill: false });
  });
  it("signals sandwich crossings only when the replay moves forwards", () => {
    expect(crossedSandwich(50, 60, [60, 80])).toBe(true);
    expect(crossedSandwich(60, 60, [60])).toBe(false);
    expect(crossedSandwich(60, 50, [55])).toBe(false);
    expect(crossedSandwich(60, 70, [60, 80])).toBe(false);
  });
});
