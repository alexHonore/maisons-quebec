import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

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

export function recordPageView(db: DatabaseSync, rawPath: string, now = new Date()): boolean {
  const path = normalizePublicPath(rawPath);
  if (!path) return false;
  db.prepare("INSERT INTO page_views (id, path, occurred_at) VALUES (?, ?, ?)").run(randomUUID(), path, now.toISOString());
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
