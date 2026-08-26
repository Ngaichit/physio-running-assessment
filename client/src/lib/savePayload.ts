/**
 * Drop keys whose value is unchanged from what the server already stores.
 *
 * Needed for the InBody/VO2 `data:` URLs. They live in the same form state as
 * every other field, so the 3s debounced autosave was re-sending the entire
 * PDF on every keystroke — a multi-MB POST per edit, which is exactly the
 * shape of request that gets dropped mid-flight. The update route marks these
 * fields optional, so omitting one leaves the stored value untouched.
 */
export function omitUnchanged<T extends Record<string, any>>(
  data: T,
  lastSaved: Partial<T> | null | undefined,
  keys: readonly (keyof T)[],
): T {
  if (!lastSaved) return data;
  const out = { ...data };
  for (const key of keys) {
    if (key in out && key in lastSaved && out[key] === lastSaved[key]) {
      delete out[key];
    }
  }
  return out;
}

/**
 * Heavy columns worth diffing. Everything else in an assessment is short text
 * or a number, where re-sending an unchanged value costs nothing.
 */
export const HEAVY_ASSESSMENT_FIELDS = ["inbodyFileUrl", "vo2FileUrl"] as const;
