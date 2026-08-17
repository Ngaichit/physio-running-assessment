import { describe, it, expect } from "vitest";
import {
  PLAYBACK_RATES,
  MIN_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  clampPlaybackRate,
  formatPlaybackRate,
} from "./playbackRate";

describe("PLAYBACK_RATES", () => {
  it("offers normal speed so the user can always get back to 1x", () => {
    expect(PLAYBACK_RATES).toContain(1);
  });

  it("is ordered slowest to fastest", () => {
    const sorted = [...PLAYBACK_RATES].sort((a, b) => a - b);
    expect(PLAYBACK_RATES).toEqual(sorted);
  });

  it("leads with slow-motion options, which is what gait analysis needs", () => {
    expect(PLAYBACK_RATES[0]).toBeLessThan(0.5);
    expect(PLAYBACK_RATES.filter(r => r < 1).length).toBeGreaterThanOrEqual(3);
  });

  it("only offers rates browsers actually support", () => {
    for (const rate of PLAYBACK_RATES) {
      expect(rate).toBeGreaterThanOrEqual(MIN_PLAYBACK_RATE);
      expect(rate).toBeLessThanOrEqual(MAX_PLAYBACK_RATE);
    }
  });
});

describe("clampPlaybackRate", () => {
  it("passes through supported rates untouched", () => {
    expect(clampPlaybackRate(0.5)).toBe(0.5);
    expect(clampPlaybackRate(1)).toBe(1);
    expect(clampPlaybackRate(2)).toBe(2);
  });

  it("clamps rates outside the range browsers accept", () => {
    expect(clampPlaybackRate(0)).toBe(MIN_PLAYBACK_RATE);
    expect(clampPlaybackRate(-1)).toBe(MIN_PLAYBACK_RATE);
    expect(clampPlaybackRate(1000)).toBe(MAX_PLAYBACK_RATE);
  });

  it("falls back to normal speed for junk input", () => {
    expect(clampPlaybackRate(NaN)).toBe(1);
    expect(clampPlaybackRate(Number.POSITIVE_INFINITY)).toBe(1);
    expect(clampPlaybackRate(Number.parseFloat("nonsense"))).toBe(1);
  });
});

describe("formatPlaybackRate", () => {
  it("labels normal speed without trailing zeros", () => {
    expect(formatPlaybackRate(1)).toBe("1×");
    expect(formatPlaybackRate(2)).toBe("2×");
  });

  it("keeps the precision of fractional rates", () => {
    expect(formatPlaybackRate(0.5)).toBe("0.5×");
    expect(formatPlaybackRate(0.25)).toBe("0.25×");
    expect(formatPlaybackRate(1.5)).toBe("1.5×");
  });

  it("labels every offered rate distinctly", () => {
    const labels = PLAYBACK_RATES.map(formatPlaybackRate);
    expect(new Set(labels).size).toBe(PLAYBACK_RATES.length);
  });
});
