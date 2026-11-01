import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import { contentSlug } from "../domain/content-page";

export type ContentRedirect = {
  readonly fromPath: string;
  readonly toPath: string;
};

const GUIDE_PATH = /^\/guides\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function guidePath(raw: string): string | null {
  const path = raw.trim();
  const match = GUIDE_PATH.exec(path);
  const slug = match ? contentSlug(match[1] ?? "") : null;
  if (!slug) return null;
  return `/guides/${slug}`;
}

export function redirectWouldLoop(fromPath: string, toPath: string, existing: readonly ContentRedirect[]): boolean {
  if (fromPath === toPath) return true;
  const next = new Map(existing.filter((row) => row.fromPath !== fromPath).map((row) => [row.fromPath, row.toPath]));
  next.set(fromPath, toPath);
  const seen = new Set<string>();
  let cursor = fromPath;
  while (next.has(cursor)) {
    if (seen.has(cursor)) return true;
    seen.add(cursor);
    const target = next.get(cursor);
    if (!target) return false;
    cursor = target;
  }
  return false;
}

function publishedSlug(db: DatabaseSync, path: string): string | null {
  const guide = guidePath(path);
  if (!guide) return null;
  const slug = guide.slice("/guides/".length);
  const row = db.prepare("SELECT id FROM content_pages WHERE slug = ? AND status = 'published'").get(slug);
  return row ? slug : null;
}

export function listContentRedirects(db: DatabaseSync): ContentRedirect[] {
  return db
    .prepare("SELECT from_path, to_path FROM content_redirects ORDER BY from_path ASC")
    .all()
    .map((row) => ({ fromPath: String(row.from_path), toPath: String(row.to_path) }));
}

export function saveContentRedirect(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; fromPath: string; toPath: string; now: Date },
): { ok: true } | { ok: false; reason: "forbidden" | "invalid" | "unpublished" | "loop" | "duplicate" } {
  if (!roleCan(input.actorRole, "content.write")) return { ok: false, reason: "forbidden" };
  const fromPath = guidePath(input.fromPath);
  const toPath = guidePath(input.toPath);
  if (!fromPath || !toPath) return { ok: false, reason: "invalid" };
  if (!publishedSlug(db, fromPath) || !publishedSlug(db, toPath)) return { ok: false, reason: "unpublished" };
  const existing = listContentRedirects(db);
  if (existing.some((row) => row.fromPath === fromPath)) return { ok: false, reason: "duplicate" };
  if (redirectWouldLoop(fromPath, toPath, existing)) return { ok: false, reason: "loop" };
  db.prepare(
    "INSERT INTO content_redirects (id, from_path, to_path, created_at, created_by) VALUES (?, ?, ?, ?, ?)",
  ).run(randomUUID(), fromPath, toPath, input.now.toISOString(), input.actorId);
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "content.redirect_saved",
    subjectId: fromPath,
    at: input.now,
  });
  return { ok: true };
}

/** 301 vers une page encore publiée. Une cible retirée ne redirige plus. */
export function resolvePublishedRedirect(
  db: DatabaseSync,
  pathname: string,
): { readonly status: 301; readonly pathname: string } | null {
  const fromPath = guidePath(pathname);
  if (!fromPath) return null;
  const row = db.prepare("SELECT to_path FROM content_redirects WHERE from_path = ?").get(fromPath);
  if (!row) return null;
  const toPath = guidePath(String(row.to_path));
  if (!toPath || !publishedSlug(db, toPath)) return null;
  return { status: 301, pathname: toPath };
}
