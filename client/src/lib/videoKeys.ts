// Keyboard mapping for video review. Kept DOM-free so it can be unit tested.

export type VideoKeyAction = "toggle-play" | "step-back" | "step-forward";

export function videoKeyAction(key: string): VideoKeyAction | null {
  if (key === " " || key === "Spacebar") return "toggle-play";
  if (key === "ArrowLeft") return "step-back";
  if (key === "ArrowRight") return "step-forward";
  return null;
}

/**
 * Whether a key event target is somewhere the user is typing. Playback keys are
 * intercepted everywhere else — including the drawing canvas and the toolbar —
 * so duck-type rather than instanceof to keep this testable outside a browser.
 */
export function isTextEntryTarget(
  target: { tagName?: string; isContentEditable?: boolean } | null | undefined,
): boolean {
  if (!target) return false;
  if (target.isContentEditable) return true;
  const tag = (target.tagName ?? "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}
