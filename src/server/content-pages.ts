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
import { scoreContentPage, type EditorialScores } from "../domain/editorial-scores";
import { resolvePublishedRedirect } from "./content-redirects";

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
  readonly scores: EditorialScores;
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
  const scores = scoreContentPage(page);
  return { ...page, scores, assessment: assessContentPage(page, { scoresPassed: scores.passed }) };
}

function recordScoreRun(db: DatabaseSync, pageId: string, scores: EditorialScores, at: string): void {
  db.prepare(
    `INSERT INTO content_score_runs (
       id, page_id, rubric_version, seo_score, citability_score, conversion_score, passed, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), pageId, scores.rubricVersion, scores.seo, scores.citability, scores.conversion, scores.passed ? 1 : 0, at);
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
  if (existing && String(existing.status) === "published") {
    appendContentVersion(db, id, input.actorId, now, null);
  }
  const saved = db.prepare(`${ROW_SQL} WHERE id = ?`).get(id);
  if (saved) recordScoreRun(db, id, scoreContentPage({
    title: String(saved.title),
    description: String(saved.description),
    body: String(saved.body),
    sourceNote: String(saved.source_note),
    example: Number(saved.example) === 1,
  }), now);
  return { ok: true, id };
}

function appendContentVersion(
  db: DatabaseSync,
  pageId: string,
  actorId: string,
  at: string,
  restoredFrom: number | null,
): number {
  const page = db.prepare(`${ROW_SQL} WHERE id = ?`).get(pageId);
  if (!page) throw new Error("Page introuvable pour la version.");
  const current = db.prepare("SELECT COALESCE(MAX(version_number), 0) AS total FROM content_versions WHERE page_id = ?").get(pageId);
  const versionNumber = Number(current?.total ?? 0) + 1;
  db.prepare(
    `INSERT INTO content_versions (
       id, page_id, version_number, slug, title, description, body, source_note, example, created_at, created_by, restored_from
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    pageId,
    versionNumber,
    String(page.slug),
    String(page.title),
    String(page.description),
    String(page.body),
    String(page.source_note),
    Number(page.example),
    at,
    actorId,
    restoredFrom,
  );
  return versionNumber;
}

export function setContentPublished(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; id: string; published: boolean; now: Date },
): { ok: true } | { ok: false; reason: "forbidden" | "missing" | "score_below_threshold" } {
  if (!roleCan(input.actorRole, "content.publish")) return { ok: false, reason: "forbidden" };
  const existing = db.prepare(`${ROW_SQL} WHERE id = ?`).get(input.id);
  if (!existing) return { ok: false, reason: "missing" };
  const now = input.now.toISOString();
  if (input.published) {
    const scores = scoreContentPage({
      title: String(existing.title),
      description: String(existing.description),
      body: String(existing.body),
      sourceNote: String(existing.source_note),
      example: Number(existing.example) === 1,
    });
    recordScoreRun(db, input.id, scores, now);
    if (!scores.passed) return { ok: false, reason: "score_below_threshold" };
    db.prepare("UPDATE content_pages SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?").run(now, now, input.id);
    appendContentVersion(db, input.id, input.actorId, now, null);
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

export type ContentVersion = {
  readonly id: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly body: string;
  readonly createdAt: string;
  readonly restoredFrom: number | null;
};

export function listContentVersions(db: DatabaseSync, pageId: string): ContentVersion[] {
  return db
    .prepare(
      `SELECT id, version_number, title, body, created_at, restored_from
       FROM content_versions WHERE page_id = ? ORDER BY version_number ASC`,
    )
    .all(pageId)
    .map((row) => ({
      id: String(row.id),
      versionNumber: Number(row.version_number),
      title: String(row.title),
      body: String(row.body),
      createdAt: String(row.created_at),
      restoredFrom: row.restored_from === null || row.restored_from === undefined ? null : Number(row.restored_from),
    }));
}

export function restoreContentVersion(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; pageId: string; versionNumber: number; now: Date },
): { ok: true; versionNumber: number } | { ok: false; reason: "forbidden" | "missing" | "duplicate_slug" } {
  if (!roleCan(input.actorRole, "content.publish")) return { ok: false, reason: "forbidden" };
  const version = db
    .prepare(
      `SELECT version_number, slug, title, description, body, source_note, example
       FROM content_versions WHERE page_id = ? AND version_number = ?`,
    )
    .get(input.pageId, input.versionNumber);
  const page = db.prepare("SELECT id FROM content_pages WHERE id = ?").get(input.pageId);
  if (!version || !page) return { ok: false, reason: "missing" };
  const slugOwner = db.prepare("SELECT id FROM content_pages WHERE slug = ? AND id <> ?").get(String(version.slug), input.pageId);
  if (slugOwner) return { ok: false, reason: "duplicate_slug" };
  const now = input.now.toISOString();
  db.prepare(
    `UPDATE content_pages
     SET slug = ?, title = ?, description = ?, body = ?, source_note = ?, example = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    String(version.slug),
    String(version.title),
    String(version.description),
    String(version.body),
    String(version.source_note),
    Number(version.example),
    now,
    input.pageId,
  );
  const created = appendContentVersion(db, input.pageId, input.actorId, now, Number(version.version_number));
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "content.version_restored",
    subjectId: input.pageId,
    at: input.now,
  });
  return { ok: true, versionNumber: created };
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

function nextDraftSlug(db: DatabaseSync, publishedSlug: string): string | null {
  const stem = `${publishedSlug}-brouillon`;
  for (let index = 0; index < 20; index += 1) {
    const suffix = index === 0 ? "" : `-${index + 1}`;
    const candidate = `${stem.slice(0, 60 - suffix.length)}${suffix}`;
    if (candidate.length < 3) continue;
    const taken = db.prepare("SELECT id FROM content_pages WHERE slug = ?").get(candidate);
    if (!taken) return candidate;
  }
  return null;
}

/** Copie le corps publié vers un nouveau brouillon. Ne modifie pas la page publique. */
export function openDraftFromPublishedPage(
  db: DatabaseSync,
  input: { slug: string; now: Date },
): { ok: true; id: string } | { ok: false; reason: "missing" } {
  const row = db.prepare(`${ROW_SQL} WHERE slug = ? AND status = 'published'`).get(input.slug);
  if (!row) return { ok: false, reason: "missing" };
  const slug = nextDraftSlug(db, String(row.slug));
  if (!slug) return { ok: false, reason: "missing" };
  const now = input.now.toISOString();
  const id = randomUUID();
  db.prepare(
    `INSERT INTO content_pages (
       id, slug, title, description, body, source_note, example, status, created_at, updated_at, published_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, NULL)`,
  ).run(
    id,
    slug,
    String(row.title),
    String(row.description),
    String(row.body),
    String(row.source_note),
    Number(row.example),
    now,
    now,
  );
  return { ok: true, id };
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
    .filter((page) => resolvePublishedRedirect(db, `/guides/${page.slug}`) === null)
    .map((page) => ({ slug: page.slug, updatedAt: page.updatedAt }));
}
