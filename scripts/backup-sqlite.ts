import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { settingsFilePath } from "../src/server/settings-db";
import { backupSqliteFile } from "../src/server/sqlite-backup";

const sourcePath = settingsFilePath(process.env);
const stamp = new Date().toISOString().replaceAll(":", "-");
const backupPath = process.argv[2]?.trim()
  ? path.resolve(process.argv[2])
  : path.join(path.dirname(sourcePath), "backups", `site-settings-${stamp}.sqlite`);
const restoreDir = mkdtempSync(path.join(tmpdir(), "mq-restore-"));
const restorePath = path.join(restoreDir, "site.sqlite");

const result = backupSqliteFile({
  sourcePath,
  backupPath,
  restorePath,
  knownKey: "hero_title",
});
rmSync(restoreDir, { recursive: true, force: true });

if (!result.ok) {
  console.error(
    result.reason === "copy_failed"
      ? "La copie a échoué. Aucune sauvegarde n'est disponible."
      : "La relecture a échoué. La copie n'est pas conservée.",
  );
  process.exit(1);
}

console.log(`Sauvegarde écrite : ${result.backupPath}`);
console.log("Relecture de hero_title réussie dans une base temporaire.");
