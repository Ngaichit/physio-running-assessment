// Playback speed options for video review.
//
// Browsers accept roughly 0.0625x–16x on HTMLMediaElement.playbackRate and
// throw or clamp outside that, so every offered rate stays inside the range.
export const MIN_PLAYBACK_RATE = 0.0625;
export const MAX_PLAYBACK_RATE = 16;

// Weighted towards slow motion — gait review is mostly sub-1x.
export const PLAYBACK_RATES = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2] as const;

export const DEFAULT_PLAYBACK_RATE = 1;

export function clampPlaybackRate(rate: number): number {
  if (!Number.isFinite(rate)) return DEFAULT_PLAYBACK_RATE;
  return Math.min(MAX_PLAYBACK_RATE, Math.max(MIN_PLAYBACK_RATE, rate));
}

export function formatPlaybackRate(rate: number): string {
  return `${Math.round(rate * 10000) / 10000}×`;
}
