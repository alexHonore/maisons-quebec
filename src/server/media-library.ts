import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import { mediaAssociationAllowed, parseMediaAsset, requestImageProvider, type MediaCredit } from "../domain/media-asset";

export type MediaAssetView = MediaCredit & {
  readonly id: string;
  readonly createdAt: string;
};

export function saveMediaAsset(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; title: string; license: string; author: string; source: string; now: Date },
): { ok: true; id: string } | { ok: false; reason: "forbidden" | "invalid" } {
  if (!roleCan(input.actorRole, "media.manage")) return { ok: false, reason: "forbidden" };
  const parsed = parseMediaAsset(input);
  if (!parsed.ok) return parsed;
  const id = randomUUID();
  db.prepare(
    `INSERT INTO media_assets (id, title, license, author, source, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, parsed.value.title, parsed.value.license, parsed.value.author, parsed.value.source, input.now.toISOString(), input.actorId);
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "media.saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id };
}

export function listMediaAssets(db: DatabaseSync): MediaAssetView[] {
  return db
    .prepare("SELECT id, title, license, author, source, created_at FROM media_assets ORDER BY created_at ASC")
    .all()
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      license: String(row.license),
      author: String(row.author),
      source: String(row.source),
      createdAt: String(row.created_at),
    }));
}

export function attachMediaToPage(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; pageId: string; assetId: string; now: Date },
): { ok: true } | { ok: false; reason: "forbidden" | "missing" | "license_required" } {
  if (!roleCan(input.actorRole, "media.manage")) return { ok: false, reason: "forbidden" };
  const page = db.prepare("SELECT id FROM content_pages WHERE id = ?").get(input.pageId);
  const asset = db.prepare("SELECT id, license FROM media_assets WHERE id = ?").get(input.assetId);
  if (!page || !asset) return { ok: false, reason: "missing" };
  if (!mediaAssociationAllowed(String(asset.license))) return { ok: false, reason: "license_required" };
  const existing = db
    .prepare("SELECT id FROM content_media WHERE page_id = ? AND asset_id = ?")
    .get(input.pageId, input.assetId);
  if (!existing) {
    db.prepare("INSERT INTO content_media (id, page_id, asset_id, created_at) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      input.pageId,
      input.assetId,
      input.now.toISOString(),
    );
  }
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "media.attached",
    subjectId: input.assetId,
    at: input.now,
  });
  return { ok: true };
}

export function imageProviderStatus(apiKey: string | undefined): "à connecter" | "non branché" {
  return requestImageProvider({ apiKey }).message;
}
