import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { MIN_INDEXABLE_BODY_LENGTH } from "../domain/content-page";
import { auditPlainText } from "./admin-audit";
import {
  listContentVersions,
  listIndexableGuidePaths,
  listPublishedGuides,
  readContentForPreview,
  readPublicContentPage,
  restoreContentVersion,
  saveContentDraft,
  setContentPublished,
} from "./content-pages";
import { migrateDown, migrateUp } from "./settings-db";

const now = new Date("2026-10-31T23:10:00.000Z");
const sentence = "Cette page explique une méthode de lecture. Elle ne donne aucun prix et aucune statistique. ";

function longBody(): string {
  let body = "";
  while (body.length < MIN_INDEXABLE_BODY_LENGTH) body += sentence;
  return body;
}

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

const enough = {
  slug: "lire-une-methode",
  title: "Lire une méthode",
  description: "Une méthode sans chiffre de marché.",
  body: longBody(),
  sourceNote: "Note de méthode rédigée pour Maisons Québec.",
  example: false,
};

describe("pages de contenu persistées", () => {
  it("sert une publication depuis SQLite et cache le brouillon au public", () => {
    const db = freshDb();
    assert.equal(saveContentDraft(db, { actorId: "editeur", actorRole: "editor", ...enough, now }).ok, true);
    const created = saveContentDraft(db, { actorId: "editeur", actorRole: "editor", ...enough, slug: "autre-methode", now });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(readPublicContentPage(db, "autre-methode"), null);
    assert.equal(readContentForPreview(db, { actorRole: "analyst", id: created.id }).ok, false);
    const preview = readContentForPreview(db, { actorRole: "editor", id: created.id });
    assert.equal(preview.ok && preview.page.status === "draft" && preview.page.assessment.robots === "noindex, nofollow", true);
    assert.equal(setContentPublished(db, { actorId: "editeur", actorRole: "editor", id: created.id, published: true, now }).ok, false);
    assert.equal(saveContentDraft(db, {
      actorId: "editeur",
      actorRole: "editor",
      id: created.id,
      ...enough,
      slug: "autre-methode",
      body: "brouillon encore",
      now,
    }).ok, true);
    assert.equal(setContentPublished(db, { actorId: "owner-1", actorRole: "owner", id: created.id, published: true, now }).ok, true);
    assert.equal(saveContentDraft(db, {
      actorId: "editeur",
      actorRole: "editor",
      id: created.id,
      ...enough,
      slug: "autre-methode",
      now,
    }).ok, false);
    const revised = "Texte revu après publication, toujours sans chiffre de marché. ";
    let nextBody = "";
    while (nextBody.length < MIN_INDEXABLE_BODY_LENGTH) nextBody += revised;
    assert.equal(saveContentDraft(db, {
      actorId: "owner-1",
      actorRole: "owner",
      id: created.id,
      ...enough,
      slug: "autre-methode",
      body: nextBody,
      now,
    }).ok, true);
    const live = readPublicContentPage(db, "autre-methode");
    assert.equal(live?.body, nextBody.trim());
    assert.equal(live?.assessment.indexable, true);
    assert.equal(live?.assessment.robots, "index, follow");
    assert.equal(setContentPublished(db, { actorId: "owner-1", actorRole: "owner", id: created.id, published: false, now }).ok, true);
    assert.equal(readPublicContentPage(db, "autre-methode"), null);
    assert.equal(auditPlainText(db).includes(nextBody.slice(0, 40)), false);
    migrateDown(db);
    assert.throws(() => db.prepare("SELECT id FROM content_pages").all());
    db.close();
  });

  it("laisse publique mais noindex une page publiée trop faible, et indexe la page suffisante", () => {
    const db = freshDb();
    const thin = saveContentDraft(db, {
      actorId: "owner-1",
      actorRole: "owner",
      ...enough,
      slug: "note-courte",
      body: "Une note courte.",
      now,
    });
    const example = saveContentDraft(db, {
      actorId: "owner-1",
      actorRole: "owner",
      ...enough,
      slug: "exemple-de-page",
      example: true,
      now,
    });
    const solid = saveContentDraft(db, {
      actorId: "owner-1",
      actorRole: "owner",
      ...enough,
      slug: "methode-publique",
      now,
    });
    assert.equal(thin.ok && example.ok && solid.ok, true);
    if (!thin.ok || !example.ok || !solid.ok) return;
    for (const id of [thin.id, example.id, solid.id]) {
      assert.equal(setContentPublished(db, { actorId: "owner-1", actorRole: "owner", id, published: true, now }).ok, true);
    }
    const thinPage = readPublicContentPage(db, "note-courte");
    const examplePage = readPublicContentPage(db, "exemple-de-page");
    const solidPage = readPublicContentPage(db, "methode-publique");
    assert.equal(thinPage?.assessment.visible, true);
    assert.equal(thinPage?.assessment.indexable, false);
    assert.equal(thinPage?.assessment.robots, "noindex, nofollow");
    assert.equal(examplePage?.example, true);
    assert.equal(examplePage?.assessment.indexable, false);
    assert.equal(examplePage?.assessment.reason, "example");
    assert.equal(solidPage?.assessment.indexable, true);
    assert.deepEqual(listPublishedGuides(db).map((page) => page.slug).sort(), ["exemple-de-page", "methode-publique", "note-courte"]);
    assert.deepEqual(listIndexableGuidePaths(db), [{ slug: "methode-publique", updatedAt: now.toISOString() }]);
    assert.equal(listPublishedGuides(db).some((page) => page.slug === "methode-publique" && page.indexable), true);
    db.close();
  });

  it("enregistre chaque publication et restaure sans effacer l'historique", () => {
    const db = freshDb();
    const created = saveContentDraft(db, { actorId: "owner-1", actorRole: "owner", ...enough, now });
    assert.equal(created.ok, true);
    if (!created.ok) return;
    assert.equal(listContentVersions(db, created.id).length, 0);
    assert.equal(setContentPublished(db, { actorId: "editeur", actorRole: "editor", id: created.id, published: true, now }).ok, false);
    assert.equal(setContentPublished(db, { actorId: "owner-1", actorRole: "owner", id: created.id, published: true, now }).ok, true);
    const firstBody = readPublicContentPage(db, enough.slug)?.body ?? "";
    assert.equal(listContentVersions(db, created.id).length, 1);
    const revised = `${firstBody} La phrase ajoutée reste sans prix.`;
    assert.equal(saveContentDraft(db, {
      actorId: "owner-1",
      actorRole: "owner",
      id: created.id,
      ...enough,
      body: revised,
      now,
    }).ok, true);
    assert.equal(listContentVersions(db, created.id).map((version) => version.versionNumber).join(","), "1,2");
    assert.equal(restoreContentVersion(db, {
      actorId: "editeur",
      actorRole: "editor",
      pageId: created.id,
      versionNumber: 1,
      now,
    }).ok, false);
    const restored = restoreContentVersion(db, {
      actorId: "owner-1",
      actorRole: "owner",
      pageId: created.id,
      versionNumber: 1,
      now,
    });
    assert.equal(restored.ok && restored.versionNumber === 3, true);
    const versions = listContentVersions(db, created.id);
    assert.deepEqual(versions.map((version) => version.versionNumber), [1, 2, 3]);
    assert.equal(versions[0]?.body, firstBody);
    assert.equal(versions[1]?.body.endsWith("sans prix."), true);
    assert.equal(versions[2]?.body, firstBody);
    assert.equal(versions[2]?.restoredFrom, 1);
    assert.equal(readPublicContentPage(db, enough.slug)?.body, firstBody);
    assert.equal(auditPlainText(db).includes(firstBody.slice(0, 40)), false);
    db.close();
  });
});
