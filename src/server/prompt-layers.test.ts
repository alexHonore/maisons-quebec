import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { auditPlainText } from "./admin-audit";
import { L0_SHA256, readL0Prompt } from "./editorial-l0";
import { currentPromptLayer, listPromptLayers, savePromptLayer } from "./prompt-layers";
import { migrateUp } from "./settings-db";

const now = new Date("2026-10-31T23:50:00.000Z");

describe("prompts L1 et L2", () => {
  it("versionne L1 et L2 sans écraser le fichier L0", () => {
    const before = readL0Prompt();
    assert.equal(before.sha256, L0_SHA256);
    const db = new DatabaseSync(":memory:");
    migrateUp(db);
    assert.equal(savePromptLayer(db, {
      actorId: "analyste",
      actorRole: "analyst",
      layer: "L1",
      body: "Voix de marque, MARQUEUR-TEST.",
      now,
    }).ok, false);
    assert.equal(savePromptLayer(db, {
      actorId: "owner-1",
      actorRole: "owner",
      layer: "L0",
      body: "Tentative de remplacer le prompt fondamental.",
      now,
    }).ok, false);
    const first = savePromptLayer(db, {
      actorId: "editeur",
      actorRole: "editor",
      layer: "L1",
      body: "Voix de marque, MARQUEUR-TEST.",
      now,
    });
    assert.equal(first.ok && first.versionNumber === 1, true);
    const second = savePromptLayer(db, {
      actorId: "owner-1",
      actorRole: "owner",
      layer: "L1",
      body: "Deuxième voix de marque.",
      now,
    });
    assert.equal(second.ok && second.versionNumber === 2, true);
    const task = savePromptLayer(db, {
      actorId: "editeur",
      actorRole: "editor",
      layer: "L2",
      body: "Tâche : expliquer une méthode, sans inventer de prix.",
      now,
    });
    assert.equal(task.ok && task.versionNumber === 1, true);
    const l1 = listPromptLayers(db, "L1");
    assert.deepEqual(l1.map((item) => item.versionNumber), [1, 2]);
    assert.equal(l1[0]?.body, "Voix de marque, MARQUEUR-TEST.");
    assert.equal(currentPromptLayer(db, "L1")?.body, "Deuxième voix de marque.");
    assert.equal(currentPromptLayer(db, "L2")?.versionNumber, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM prompt_layers WHERE layer = 'L0'").get()?.total, 0);
    assert.equal(readL0Prompt().text, before.text);
    assert.equal(readL0Prompt().sha256, L0_SHA256);
    assert.equal(auditPlainText(db).includes("MARQUEUR-TEST"), false);
    db.close();
  });
});