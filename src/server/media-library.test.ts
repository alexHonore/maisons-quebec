import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import { requestImageProvider } from "../domain/media-asset";
import { saveContentDraft } from "./content-pages";
import { attachMediaToPage, listMediaAssets, saveMediaAsset } from "./media-library";
import { migrateUp } from "./settings-db";

const now = new Date("2026-10-31T23:40:00.000Z");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

function pageId(db: DatabaseSync): string {
  const saved = saveContentDraft(db, {
    actorId: "owner-1",
    actorRole: "owner",
    slug: "note-media",
    title: "Note media",
    description: "Brouillon pour lier une fiche.",
    body: "Texte court.",
    sourceNote: "Note interne.",
    example: true,
    now,
  });
  if (!saved.ok) throw new Error(saved.reason);
  return saved.id;
}

describe("médiathèque", () => {
  it("refuse d'associer un actif sans licence et n'enregistre pas la fiche incomplète", () => {
    const db = freshDb();
    const contentId = pageId(db);
    assert.equal(saveMediaAsset(db, {
      actorId: "analyste",
      actorRole: "analyst",
      title: "Illustration",
      license: "CC BY 4.0",
      author: "Auteur saisi",
      source: "Fiche fournie pour l'essai",
      now,
    }).ok, false);
    assert.equal(saveMediaAsset(db, {
      actorId: "owner-1",
      actorRole: "owner",
      title: "Illustration",
      license: "",
      author: "Auteur saisi",
      source: "Fiche fournie pour l'essai",
      now,
    }).ok, false);
    assert.equal(listMediaAssets(db).length, 0);
    const bareId = randomUUID();
    db.prepare("INSERT INTO media_assets (id, title, license, author, source, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      bareId,
      "Illustration sans licence",
      "",
      "Auteur saisi",
      "Fiche fournie pour l'essai",
      now.toISOString(),
      "owner-1",
    );
    const refused = attachMediaToPage(db, {
      actorId: "editeur",
      actorRole: "editor",
      pageId: contentId,
      assetId: bareId,
      now,
    });
    assert.deepEqual(refused, { ok: false, reason: "license_required" });
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM content_media").get()?.total, 0);
    const emptyLabel = randomUUID();
    db.prepare("INSERT INTO media_assets (id, title, license, author, source, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      emptyLabel,
      "Illustration sans licence",
      REGULATORY_EMPTY_LABEL,
      "Auteur saisi",
      "Fiche fournie pour l'essai",
      now.toISOString(),
      "owner-1",
    );
    assert.equal(attachMediaToPage(db, {
      actorId: "owner-1",
      actorRole: "owner",
      pageId: contentId,
      assetId: emptyLabel,
      now,
    }).ok, false);
    const saved = saveMediaAsset(db, {
      actorId: "editeur",
      actorRole: "editor",
      title: "Illustration saisie",
      license: "CC BY 4.0",
      author: "Auteur saisi",
      source: "Fiche fournie pour l'essai",
      now,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(attachMediaToPage(db, {
      actorId: "owner-1",
      actorRole: "owner",
      pageId: contentId,
      assetId: saved.id,
      now,
    }).ok, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM content_media").get()?.total, 1);
    db.close();
  });

  it("n'enregistre aucune image quand les clés de fournisseurs sont vides", async () => {
    const db = freshDb();
    let called = 0;
    const transport = async () => {
      called += 1;
      return { status: 200 };
    };
    const keys = { PEXELS_API_KEY: "", UNSPLASH_ACCESS_KEY: "  ", IMAGE_GENERATION_API_KEY: undefined };
    for (const key of [keys.PEXELS_API_KEY, keys.UNSPLASH_ACCESS_KEY, keys.IMAGE_GENERATION_API_KEY]) {
      const result = requestImageProvider({ apiKey: key, transport });
      assert.equal(result.message, "à connecter");
      assert.equal(result.recordedImage, false);
    }
    assert.equal(called, 0);
    assert.equal(listMediaAssets(db).length, 0);
    db.close();
  });
});
