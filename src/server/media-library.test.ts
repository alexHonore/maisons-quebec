import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ContentArticle } from "../components/content-article";
import { MIN_INDEXABLE_BODY_LENGTH } from "../domain/content-page";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import { requestImageProvider } from "../domain/media-asset";
import { saveContentDraft, setContentPublished } from "./content-pages";
import { attachMediaToPage, listMediaAssets, listPublishedPageMedia, mediaDirectory, readPublicMediaFile, saveMediaAsset } from "./media-library";
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

  it("garde le fichier hors du dépôt seulement avec une fiche complète, et le public ne voit pas le brouillon", () => {
    const db = freshDb();
    const directory = mkdtempSync(path.join(tmpdir(), "mq-media-"));
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const credit = {
      actorId: "editeur",
      actorRole: "editor" as const,
      title: "Illustration saisie",
      license: "CC BY 4.0",
      author: "Auteur saisi",
      source: "Fiche fournie pour l'essai",
      now,
      directory,
    };
    try {
      assert.equal(saveMediaAsset(db, { ...credit, license: "", file: png }).ok, false);
      assert.equal(existsSync(directory) && readdirSync(directory).length === 0, true);
      assert.equal(saveMediaAsset(db, { ...credit, file: Uint8Array.from([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0, 0, 0, 0, 0, 0, 0]) }).ok, false);
      assert.equal(readdirSync(directory).length, 0);
      const stored = saveMediaAsset(db, { ...credit, file: png });
      assert.equal(stored.ok, true);
      if (!stored.ok) return;
      assert.equal(stored.storedFile, true);
      const written = path.join(directory, `${stored.id}.png`);
      assert.equal(readFileSync(written).equals(Buffer.from(png)), true);
      assert.equal(written.startsWith(directory), true);
      assert.equal(mediaDirectory({}).endsWith(`${path.sep}data${path.sep}media`), true);
      assert.equal(readFileSync(path.join(process.cwd(), ".gitignore"), "utf8").includes("/data/"), true);
      const draftId = pageId(db);
      assert.equal(attachMediaToPage(db, { actorId: "owner-1", actorRole: "owner", pageId: draftId, assetId: stored.id, now }).ok, true);
      assert.deepEqual(listPublishedPageMedia(db, draftId), []);
      assert.equal(readPublicMediaFile(db, stored.id, directory), null);
      let body = "";
      while (body.length < MIN_INDEXABLE_BODY_LENGTH) {
        body += "Cette page explique une méthode de lecture. Elle ne donne aucun prix et aucune statistique. ";
      }
      const published = saveContentDraft(db, {
        actorId: "owner-1",
        actorRole: "owner",
        slug: "lire-une-methode",
        title: "Lire une méthode",
        description: "Cette description présente une méthode de lecture, sans chiffre de marché.",
        body: `${body.trim()}\n\nCette méthode ne constitue pas un prix de marché. Elle concerne une personne qui veut vendre à Québec. Voir /vendre/calculateur-produit-net.`,
        sourceNote: "Note de méthode rédigée pour Maisons Québec.",
        example: false,
        now,
      });
      assert.equal(published.ok, true);
      if (!published.ok) return;
      assert.equal(attachMediaToPage(db, { actorId: "owner-1", actorRole: "owner", pageId: published.id, assetId: stored.id, now }).ok, true);
      assert.equal(setContentPublished(db, { actorId: "owner-1", actorRole: "owner", id: published.id, published: true, now }).ok, true);
      const visible = listPublishedPageMedia(db, published.id);
      assert.equal(visible.length, 1);
      assert.equal(visible[0]?.author, "Auteur saisi");
      assert.equal(visible[0]?.license, "CC BY 4.0");
      assert.equal(visible[0]?.source, "Fiche fournie pour l'essai");
      const served = readPublicMediaFile(db, stored.id, directory);
      assert.equal(served?.contentType, "image/png");
      assert.equal(served?.bytes.equals(Buffer.from(png)), true);
      const html = renderToStaticMarkup(createElement(ContentArticle, {
        page: {
          title: "Lire une méthode",
          description: "Description.",
          body: "Texte.",
          sourceNote: "Note.",
          example: false,
          assessment: { visible: true, indexable: true, robots: "index, follow", reason: "indexable" },
        },
        preview: false,
        media: visible,
      }));
      const readable = html.replaceAll("&apos;", "'").replaceAll("&#x27;", "'");
      assert.equal(readable.includes(`/medias/${stored.id}`), true);
      assert.equal(readable.includes("Auteur saisi"), true);
      assert.equal(readable.includes("CC BY 4.0"), true);
      assert.equal(readable.includes("Fiche fournie pour l'essai"), true);
      const hidden = renderToStaticMarkup(createElement(ContentArticle, {
        page: {
          title: "Brouillon",
          description: "Description.",
          body: "Texte.",
          sourceNote: "Note.",
          example: true,
          assessment: { visible: false, indexable: false, robots: "noindex, nofollow", reason: "draft" },
        },
        preview: true,
      }));
      assert.equal(hidden.includes("/medias/"), false);
      assert.equal(hidden.includes("Auteur saisi"), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
      db.close();
    }
  });
});
