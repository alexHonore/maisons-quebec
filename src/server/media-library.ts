import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import { detectStoredImage, mediaAssociationAllowed, parseMediaAsset, requestImageProvider, type MediaCredit, type StoredImageKind } from "../domain/media-asset";

export type MediaAssetView = MediaCredit & {
  readonly id: string;
  readonly createdAt: string;
  readonly hasFile: boolean;
};

export type PublicMediaCredit = MediaCredit & {
  readonly id: string;
};

const FILE_TYPES: Record<StoredImageKind["ext"], StoredImageKind["contentType"]> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/** Hors du dépôt : `data/` est ignoré par git. Un essai peut passer un autre dossier. */
export function mediaDirectory(env: { readonly [key: string]: string | undefined }): string {
  const configured = env.MEDIA_DIR?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "media");
}

function storedPath(directory: string, id: string, ext: string): string | null {
  if (!/^[0-9a-f-]{36}$/i.test(id) || !(ext in FILE_TYPES)) return null;
  const root = path.resolve(directory);
  const filePath = path.resolve(root, `${id}.${ext}`);
  if (!filePath.startsWith(`${root}${path.sep}`)) return null;
  return filePath;
}

export function saveMediaAsset(
  db: DatabaseSync,
  input: {
    actorId: string;
    actorRole: AdminRole;
    title: string;
    license: string;
    author: string;
    source: string;
    now: Date;
    file?: Uint8Array | null;
    directory?: string;
  },
): { ok: true; id: string; storedFile: boolean } | { ok: false; reason: "forbidden" | "invalid" | "not_image" | "store_failed" } {
  if (!roleCan(input.actorRole, "media.manage")) return { ok: false, reason: "forbidden" };
  const parsed = parseMediaAsset(input);
  if (!parsed.ok) return parsed;
  const file = input.file && input.file.length > 0 ? input.file : null;
  const detected = file ? detectStoredImage(file) : null;
  if (file && !detected) return { ok: false, reason: "not_image" };
  const id = randomUUID();
  const filePath = detected && input.directory ? storedPath(input.directory, id, detected.ext) : null;
  if (detected && !filePath) return { ok: false, reason: "store_failed" };
  if (file && filePath && input.directory) {
    try {
      mkdirSync(input.directory, { recursive: true });
      writeFileSync(filePath, file);
    } catch {
      return { ok: false, reason: "store_failed" };
    }
  }
  try {
    db.prepare(
      `INSERT INTO media_assets (id, title, license, author, source, created_at, created_by, file_ext)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      parsed.value.title,
      parsed.value.license,
      parsed.value.author,
      parsed.value.source,
      input.now.toISOString(),
      input.actorId,
      detected?.ext ?? null,
    );
  } catch (error) {
    if (filePath) {
      try {
        unlinkSync(filePath);
      } catch {
        // Le fichier orphelin ne remplace pas l'échec d'écriture.
      }
    }
    throw error;
  }
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "media.saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id, storedFile: detected !== null };
}

export function listMediaAssets(db: DatabaseSync): MediaAssetView[] {
  return db
    .prepare("SELECT id, title, license, author, source, created_at, file_ext FROM media_assets ORDER BY created_at ASC")
    .all()
    .map((row) => ({
      id: String(row.id),
      title: String(row.title),
      license: String(row.license),
      author: String(row.author),
      source: String(row.source),
      createdAt: String(row.created_at),
      hasFile: row.file_ext !== null && row.file_ext !== undefined && String(row.file_ext) !== "",
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

const PUBLIC_MEDIA_SQL = `
  SELECT media_assets.id, media_assets.title, media_assets.license, media_assets.author, media_assets.source, media_assets.file_ext
  FROM content_media
  JOIN media_assets ON media_assets.id = content_media.asset_id
  JOIN content_pages ON content_pages.id = content_media.page_id
  WHERE content_pages.status = 'published' AND media_assets.file_ext IS NOT NULL
`;

function publicCredit(row: Record<string, unknown>): PublicMediaCredit | null {
  if (!mediaAssociationAllowed(String(row.license ?? ""))) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    license: String(row.license),
    author: String(row.author),
    source: String(row.source),
  };
}

export function listPublishedPageMedia(db: DatabaseSync, pageId: string): PublicMediaCredit[] {
  return db
    .prepare(`${PUBLIC_MEDIA_SQL} AND content_pages.id = ? ORDER BY media_assets.created_at ASC`)
    .all(pageId)
    .flatMap((row) => {
      const credit = publicCredit(row);
      return credit ? [credit] : [];
    });
}

export function readPublicMediaFile(
  db: DatabaseSync,
  id: string,
  directory: string,
): { readonly bytes: Buffer; readonly contentType: StoredImageKind["contentType"] } | null {
  const row = db.prepare(`${PUBLIC_MEDIA_SQL} AND media_assets.id = ? LIMIT 1`).get(id);
  if (!row) return null;
  const ext = String(row.file_ext ?? "");
  const contentType = FILE_TYPES[ext as StoredImageKind["ext"]];
  const filePath = contentType ? storedPath(directory, String(row.id), ext) : null;
  if (!contentType || !filePath) return null;
  try {
    return { bytes: readFileSync(filePath), contentType };
  } catch {
    return null;
  }
}
