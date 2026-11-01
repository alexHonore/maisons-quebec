export type VisibleClock = {
  readonly visibleSinceMs: number | null;
  readonly carryMs: number;
};

/** Ajoute seulement le temps où l'onglet était visible. N'invente pas de secondes. */
export function advanceVisibleClock(
  clock: VisibleClock,
  nowMs: number,
  visible: boolean,
): { readonly clock: VisibleClock; readonly seconds: number } {
  let carry = clock.carryMs;
  if (clock.visibleSinceMs !== null && nowMs > clock.visibleSinceMs) {
    carry += nowMs - clock.visibleSinceMs;
  }
  const seconds = carry >= 1000 ? Math.floor(carry / 1000) : 0;
  return {
    clock: {
      visibleSinceMs: visible ? nowMs : null,
      carryMs: carry - seconds * 1000,
    },
    seconds,
  };
}

export function parseEngagedSeconds(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1 || value > 86_400) return null;
  return value;
}
