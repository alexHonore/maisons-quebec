import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import {
  assessContentPage,
  parseContentDraft,
  type ContentAssessment,
  type ContentStatus,
} from "../domain/content-page";

export type ContentPage = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly body: string;
  readonly sourceNote: string;
  readonly example: boolean;
  readonly status: ContentStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly publishedAt: string | null;
  readonly assessment: ContentAssessment;
};

type ContentSaveFailure = "forbidden" | "invalid" | "duplicate_slug" | "published_locked" | "missing";

function mapRow(row: Record<string, unknown>): ContentPage {
  const page = {
    id: String(row.id),
    slug: String(row.slug),
    title: String(row.title),
    description: String(row.description),
    body: String(row.body),
    sourceNote: String(row.source_note),
    example: Number(row.example) === 1,
    status: row.status === "published" ? "published" : "draft",
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    publishedAt: row.published_at === null || row.published_at === undefined ? null : String(row.published_at),
  } as const;
  return { ...page, assessment: assessContentPage(page) };
}

const ROW_SQL = `SELECT id, slug, title, description, body, source_note, example, status, created_at, updated_at, published_at
  FROM content_pages`;

export function saveContentDraft(
  db: DatabaseSync,
  input: {
    actorId: string;
    actorRole: AdminRole;
    id?: string | null;
    slug: string;
    title: string;
    description: string;
    body: string;
    sourceNote: string;
    example: boolean;
    now: Date;
  },
): { ok: true; id: string } | { ok: false; reason: ContentSaveFailure } {
  if (!roleCan(input.actorRole, "content.write")) return { ok: false, reason: "forbidden" };
  const parsed = parseContentDraft(input);
  if (!parsed.ok) return parsed;
  const now = input.now.toISOString();
  const existing = input.id ? db.prepare(`${ROW_SQL} WHERE id = ?`).get(input.id) : undefined;
  if (input.id && !existing) return { ok: false, reason: "missing" };
  if (existing && String(existing.status) === "published" && !roleCan(input.actorRole, "content.publish")) {
    return { ok: false, reason: "published_locked" };
  }
  const slugOwner = db.prepare("SELECT id FROM content_pages WHERE slug = ?").get(parsed.value.slug);
  if (slugOwner && String(slugOwner.id) !== (existing ? String(existing.id) : "")) return { ok: false, reason: "duplicate_slug" };
  const id = existing ? String(existing.id) : randomUUID();
  if (!existing) {
    db.prepare(
      `INSERT INTO content_pages (
         id, slug, title, description, body, source_note, example, status, created_at, updated_at, published_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL)`,
    ).run(
      id,
      parsed.value.slug,
      parsed.value.title,
      parsed.value.description,
      parsed.value.body,
      parsed.value.sourceNote,
      parsed.value.example ? 1 : 0,
      now,
      now,
    );
  } else {
    db.prepare(
      `UPDATE content_pages
       SET slug = ?, title = ?, description = ?, body = ?, source_note = ?, example = ?, updated_at = ?
       WHERE id = ?`,
    ).run(
      parsed.value.slug,
      parsed.value.title,
      parsed.value.description,
      parsed.value.body,
      parsed.value.sourceNote,
      parsed.value.example ? 1 : 0,
      now,
      id,
    );
  }
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "content.saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id };
}

export function setContentPublished(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; id: string; published: boolean; now: Date },
): { ok: true } | { ok: false; reason: "forbidden" | "missing" } {
  if (!roleCan(input.actorRole, "content.publish")) return { ok: false, reason: "forbidden" };
  const existing = db.prepare("SELECT id FROM content_pages WHERE id = ?").get(input.id);
  if (!existing) return { ok: false, reason: "missing" };
  const now = input.now.toISOString();
  if (input.published) {
    db.prepare("UPDATE content_pages SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?").run(now, now, input.id);
  } else {
    db.prepare("UPDATE content_pages SET status = 'draft', updated_at = ? WHERE id = ?").run(now, input.id);
  }
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.published ? "content.published" : "content.unpublished",
    subjectId: input.id,
    at: input.now,
  });
  return { ok: true };
}

export function readContentForPreview(
  db: DatabaseSync,
  input: { actorRole: AdminRole; id: string },
): { ok: true; page: ContentPage } | { ok: false; reason: "forbidden" | "missing" } {
  if (!roleCan(input.actorRole, "content.preview")) return { ok: false, reason: "forbidden" };
  const row = db.prepare(`${ROW_SQL} WHERE id = ?`).get(input.id);
  if (!row) return { ok: false, reason: "missing" };
  return { ok: true, page: mapRow(row) };
}

export function readPublicContentPage(db: DatabaseSync, slug: string): ContentPage | null {
  const row = db.prepare(`${ROW_SQL} WHERE slug = ?`).get(slug);
  if (!row) return null;
  const page = mapRow(row);
  if (!page.assessment.visible) return null;
  return page;
}

export function listContentPages(db: DatabaseSync, actorRole: AdminRole): ContentPage[] | null {
  if (!roleCan(actorRole, "content.preview")) return null;
  return db.prepare(`${ROW_SQL} ORDER BY updated_at DESC`).all().map(mapRow);
}

export function listPublishedGuides(db: DatabaseSync): Array<{ slug: string; title: string; indexable: boolean }> {
  return db
    .prepare(`${ROW_SQL} WHERE status = 'published' ORDER BY title ASC`)
    .all()
    .map(mapRow)
    .map((page) => ({ slug: page.slug, title: page.title, indexable: page.assessment.indexable }));
}

export function listIndexableGuidePaths(db: DatabaseSync): Array<{ slug: string; updatedAt: string }> {
  return db
    .prepare(`${ROW_SQL} WHERE status = 'published' ORDER BY slug ASC`)
    .all()
    .map(mapRow)
    .filter((page) => page.assessment.indexable)
    .map((page) => ({ slug: page.slug, updatedAt: page.updatedAt }));
}
