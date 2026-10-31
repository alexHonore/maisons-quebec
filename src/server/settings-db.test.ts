import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import { MIGRATIONS, migrateDown, migrateUp, openSettingsDatabase, readStoredSettings, saveSettings } from "./settings-db";

describe("réglages SQLite", () => {
  it("applique et annule la migration sans écrire de permis", () => {
    const sql = MIGRATIONS.map((migration) => migration.up).join("\n");
    assert.equal(sql.includes("INSERT"), false);
    assert.doesNotMatch(sql, /permis/i);

    const db = new DatabaseSync(":memory:");
    migrateUp(db);
    const saved = saveSettings(db, { hero_title: "Titre saisi", broker_oaciq_permit: "" });
    assert.equal(saved.ok, true);
    assert.equal(readStoredSettings(db).hero_title, "Titre saisi");
    assert.equal(readStoredSettings(db).broker_oaciq_permit, "");
    migrateDown(db);
    assert.throws(() => db.prepare("SELECT key FROM site_settings").all());
    migrateUp(db);
    assert.equal(readStoredSettings(db).hero_title, "");
    assert.equal(readStoredSettings(db).broker_oaciq_permit, "");
    db.close();
  });

  it("n'enregistre pas le libellé vide comme un permis", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mq-settings-"));
    const db = openSettingsDatabase(path.join(directory, "site.sqlite"));
    const saved = saveSettings(db, {
      broker_oaciq_permit: REGULATORY_EMPTY_LABEL,
      agency_name: "Cabinet saisi pour l'essai",
      unknown: "non",
    } as never);
    assert.equal(saved.ok, false);
    const clean = saveSettings(db, {
      broker_oaciq_permit: `  ${REGULATORY_EMPTY_LABEL}  `,
      agency_name: "Cabinet saisi pour l'essai",
    });
    assert.equal(clean.ok, true);
    const stored = readStoredSettings(db);
    assert.equal(stored.broker_oaciq_permit, "");
    assert.equal(stored.agency_name, "Cabinet saisi pour l'essai");
    db.close();
  });
});
