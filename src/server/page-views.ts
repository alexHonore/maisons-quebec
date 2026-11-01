import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { parseEngagedSeconds } from "../domain/engaged-time";
import { planPublicVisit, readTrackingId } from "../domain/visit-tracking";

export const VISITOR_COOKIE = "mq_visitor";
export const SESSION_COOKIE = "mq_session";
export const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 400;

const PUBLIC_PATH = /^\/[a-z0-9/_-]*$/;

export function normalizePublicPath(raw: string): string | null {
  const path = (raw.split("?")[0] ?? "").split("#")[0] ?? "";
  if (!PUBLIC_PATH.test(path)) return null;
  if (path.startsWith("/admin") || path.startsWith("/_next")) return null;
  if (path === "/robots.txt" || path === "/sitemap.xml" || path === "/icon.svg") return null;
  if (path.includes("@")) return null;
  const trimmed = path.length > 1 && path.endsWith("/") ? path.slice(0, -1) : path;
  if (trimmed.length > 120) return null;
  return trimmed;
}

export function recordPageView(db: DatabaseSync, rawPath: string, now = new Date(), visitorId?: string | null): boolean {
  const path = normalizePublicPath(rawPath);
  if (!path) return false;
  db.prepare("INSERT INTO page_views (id, path, occurred_at, visitor_id) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    path,
    now.toISOString(),
    visitorId ?? null,
  );
  return true;
}

export function recordPublicVisit(
  db: DatabaseSync,
  input: { path: string; now?: Date; visitorCookie?: string | null; sessionCookie?: string | null },
): { ok: true; visitorId: string; sessionId: string; startSession: boolean } | { ok: false } {
  if (!normalizePublicPath(input.path)) return { ok: false };
  const plan = planPublicVisit({
    visitorCookie: input.visitorCookie,
    sessionCookie: input.sessionCookie,
    nextVisitorId: randomUUID(),
    nextSessionId: randomUUID(),
  });
  const now = input.now ?? new Date();
  const occurredAt = now.toISOString();
  db.exec("BEGIN");
  try {
    if (!recordPageView(db, input.path, now, plan.visitorId)) {
      db.exec("ROLLBACK");
      return { ok: false };
    }
    if (plan.startSession) {
      db.prepare("INSERT INTO visitor_sessions (id, visitor_id, started_at) VALUES (?, ?, ?)").run(
        plan.sessionId,
        plan.visitorId,
        occurredAt,
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, visitorId: plan.visitorId, sessionId: plan.sessionId, startSession: plan.startSession };
}

export function recordEngagedSeconds(
  db: DatabaseSync,
  input: { visitorId: string | null | undefined; seconds: unknown; now?: Date },
): boolean {
  const visitorId = readTrackingId(input.visitorId);
  const seconds = parseEngagedSeconds(input.seconds);
  if (!visitorId || seconds === null) return false;
  db.prepare("INSERT INTO engaged_seconds (id, visitor_id, seconds, occurred_at) VALUES (?, ?, ?, ?)").run(
    randomUUID(),
    visitorId,
    seconds,
    (input.now ?? new Date()).toISOString(),
  );
  return true;
}

export function shouldRecordRequest(input: {
  readonly method: string;
  readonly path: string;
  readonly accept: string;
  readonly prefetch: string | null;
  readonly rsc: string | null;
  readonly phase: string | undefined;
}): boolean {
  if (input.phase === "phase-production-build") return false;
  if (input.method !== "GET") return false;
  if (input.prefetch === "1" || input.rsc === "1") return false;
  if (!input.accept.includes("text/html")) return false;
  return normalizePublicPath(input.path) !== null;
}
