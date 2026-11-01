import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { openSettingsDatabase, saveSettings } from "./settings-db";
import { backupSqliteFile } from "./sqlite-backup";

describe("sauvegarde SQLite", () => {
  it("restaure une ligne connue et ne présente pas un échec de copie comme une sauvegarde", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "mq-backup-"));
    const sourcePath = path.join(directory, "site.sqlite");
    const backupPath = path.join(directory, "copies", "site.sqlite");
    const restorePath = path.join(directory, "restaure", "site.sqlite");
    const missingBackup = path.join(directory, "absente.sqlite");
    try {
      const db = openSettingsDatabase(sourcePath);
      assert.equal(saveSettings(db, { hero_title: "Titre saisi pour la sauvegarde" }).ok, true);
      db.close();
      const saved = backupSqliteFile({
        sourcePath,
        backupPath,
        restorePath,
        knownKey: "hero_title",
      });
      assert.equal(saved.ok, true);
      if (!saved.ok) return;
      assert.equal(saved.restoredValue, "Titre saisi pour la sauvegarde");
      assert.equal(existsSync(saved.backupPath), true);

      writeFileSync(missingBackup, "pas une sauvegarde");
      const failed = backupSqliteFile({
        sourcePath: path.join(directory, "inexistant.sqlite"),
        backupPath: missingBackup,
        restorePath: path.join(directory, "restaure-echec.sqlite"),
        knownKey: "hero_title",
      });
      assert.deepEqual(failed, { ok: false, reason: "copy_failed" });
      assert.equal(readFileSync(missingBackup, "utf8"), "pas une sauvegarde");
      assert.equal(existsSync(`${missingBackup}.partial`), false);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
