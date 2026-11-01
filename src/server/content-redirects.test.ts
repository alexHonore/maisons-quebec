import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { MIN_INDEXABLE_BODY_LENGTH } from "../domain/content-page";
import { listIndexableGuidePaths, saveContentDraft, setContentPublished } from "./content-pages";
import { resolvePublishedRedirect, saveContentRedirect } from "./content-redirects";
import { migrateUp } from "./settings-db";

const now = new Date("2026-11-01T12:00:00.000Z");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

function publish(db: DatabaseSync, slug: string): string {
  let body = "";
  while (body.length < MIN_INDEXABLE_BODY_LENGTH) {
    body += "Cette page explique une méthode de lecture. Elle ne donne aucun prix et aucune statistique. ";
  }
  const saved = saveContentDraft(db, {
    actorId: "owner-1",
    actorRole: "owner",
    slug,
    title: "Lire une méthode",
    description: "Cette description présente une méthode de lecture, sans chiffre de marché.",
    body: `${body.trim()}\n\nCette méthode ne constitue pas un prix de marché. Elle concerne une personne qui veut vendre à Québec. Voir /vendre/calculateur-produit-net.`,
    sourceNote: "Note de méthode rédigée pour Maisons Québec.",
    example: false,
    now,
  });
  if (!saved.ok) throw new Error(saved.reason);
  const published = setContentPublished(db, { actorId: "owner-1", actorRole: "owner", id: saved.id, published: true, now });
  if (!published.ok) throw new Error(published.reason);
  return saved.id;
}

describe("redirections de pages", () => {
  it("répond 301 vers une page publiée, refuse une boucle, et retire l'ancienne adresse du sitemap", () => {
    const db = freshDb();
    publish(db, "methode-ancienne");
    publish(db, "methode-nouvelle");
    const draft = saveContentDraft(db, {
      actorId: "owner-1",
      actorRole: "owner",
      slug: "methode-brouillon",
      title: "Brouillon",
      description: "Texte court.",
      body: "Pas encore public.",
      sourceNote: "Note.",
      example: true,
      now,
    });
    assert.equal(draft.ok, true);
    assert.equal(saveContentRedirect(db, {
      actorId: "analyste",
      actorRole: "analyst",
      fromPath: "/guides/methode-ancienne",
      toPath: "/guides/methode-nouvelle",
      now,
    }).ok, false);
    assert.deepEqual(saveContentRedirect(db, {
      actorId: "editeur",
      actorRole: "editor",
      fromPath: "/guides/methode-ancienne",
      toPath: "/guides/methode-brouillon",
      now,
    }), { ok: false, reason: "unpublished" });
    assert.deepEqual(saveContentRedirect(db, {
      actorId: "owner-1",
      actorRole: "owner",
      fromPath: "/guides/methode-ancienne",
      toPath: "/vendre",
      now,
    }), { ok: false, reason: "invalid" });
    assert.deepEqual(saveContentRedirect(db, {
      actorId: "editeur",
      actorRole: "editor",
      fromPath: "/guides/methode-ancienne",
      toPath: "/guides/methode-ancienne",
      now,
    }), { ok: false, reason: "loop" });
    assert.equal(saveContentRedirect(db, {
      actorId: "editeur",
      actorRole: "editor",
      fromPath: "/guides/methode-ancienne",
      toPath: "/guides/methode-nouvelle",
      now,
    }).ok, true);
    const redirect = resolvePublishedRedirect(db, "/guides/methode-ancienne");
    assert.equal(redirect?.status, 301);
    assert.equal(redirect?.pathname, "/guides/methode-nouvelle");
    const listed = listIndexableGuidePaths(db).map((page) => page.slug);
    assert.equal(listed.includes("methode-ancienne"), false);
    assert.equal(listed.includes("methode-nouvelle"), true);
    assert.deepEqual(saveContentRedirect(db, {
      actorId: "owner-1",
      actorRole: "owner",
      fromPath: "/guides/methode-nouvelle",
      toPath: "/guides/methode-ancienne",
      now,
    }), { ok: false, reason: "loop" });
    assert.equal(resolvePublishedRedirect(db, "/guides/methode-nouvelle"), null);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM content_redirects").get()?.total, 1);
    db.close();
  });
});
