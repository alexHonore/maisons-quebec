const TRACKING_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Identifiant aléatoire seulement. Un courriel ou un nom n'est pas un identifiant. */
export function readTrackingId(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!TRACKING_ID.test(value) || value.includes("@")) return null;
  return value.toLowerCase();
}

export function planPublicVisit(input: {
  readonly visitorCookie?: string | null;
  readonly sessionCookie?: string | null;
  readonly nextVisitorId: string;
  readonly nextSessionId: string;
}): { readonly visitorId: string; readonly sessionId: string; readonly startSession: boolean } {
  const visitorId = readTrackingId(input.visitorCookie) ?? readTrackingId(input.nextVisitorId);
  const sessionId = readTrackingId(input.sessionCookie);
  if (!visitorId) throw new Error("Identifiant visiteur inutilisable.");
  if (sessionId) return { visitorId, sessionId, startSession: false };
  const nextSession = readTrackingId(input.nextSessionId);
  if (!nextSession) throw new Error("Identifiant de session inutilisable.");
  return { visitorId, sessionId: nextSession, startSession: true };
}
