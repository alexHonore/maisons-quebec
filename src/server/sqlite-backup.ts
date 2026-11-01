import { copyFileSync, mkdirSync, renameSync, rmSync, statSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

export type SqliteBackupResult =
  | { readonly ok: true; readonly backupPath: string; readonly restoredValue: string }
  | { readonly ok: false; readonly reason: "copy_failed" | "restore_failed" };

function sqlFilePath(filePath: string): string | null {
  const absolute = path.resolve(filePath);
  if (absolute.includes("'") || absolute.includes("\0")) return null;
  return absolute;
}

function removeQuietly(filePath: string): void {
  try {
    rmSync(filePath, { force: true });
  } catch {
    // Un fichier partiel ne doit pas rester présenté comme une sauvegarde.
  }
}

/** Copie cohérente, puis relecture d'une clé dans une base temporaire. */
export function backupSqliteFile(input: {
  readonly sourcePath: string;
  readonly backupPath: string;
  readonly restorePath: string;
  readonly knownKey: string;
}): SqliteBackupResult {
  const sourcePath = sqlFilePath(input.sourcePath);
  const backupPath = sqlFilePath(input.backupPath);
  const restorePath = sqlFilePath(input.restorePath);
  if (!sourcePath || !backupPath || !restorePath || sourcePath === backupPath || backupPath === restorePath) {
    return { ok: false, reason: "copy_failed" };
  }
  const partialPath = `${backupPath}.partial`;
  if (partialPath === sourcePath || partialPath === restorePath || partialPath.includes("'")) {
    return { ok: false, reason: "copy_failed" };
  }
  let source: DatabaseSync | null = null;
  try {
    mkdirSync(path.dirname(partialPath), { recursive: true });
    removeQuietly(partialPath);
    source = new DatabaseSync(sourcePath, { readOnly: true });
    source.exec(`VACUUM INTO '${partialPath}'`);
    source.close();
    source = null;
    if (statSync(partialPath).size < 1) {
      removeQuietly(partialPath);
      return { ok: false, reason: "copy_failed" };
    }
  } catch {
    if (source) source.close();
    removeQuietly(partialPath);
    return { ok: false, reason: "copy_failed" };
  }

  let restored: DatabaseSync | null = null;
  try {
    mkdirSync(path.dirname(restorePath), { recursive: true });
    removeQuietly(restorePath);
    copyFileSync(partialPath, restorePath);
    restored = new DatabaseSync(restorePath, { readOnly: true });
    const row = restored.prepare("SELECT value FROM site_settings WHERE key = ?").get(input.knownKey);
    restored.close();
    restored = null;
    if (!row || typeof row.value !== "string") {
      removeQuietly(partialPath);
      removeQuietly(restorePath);
      return { ok: false, reason: "restore_failed" };
    }
    const restoredValue = row.value;
    try {
      renameSync(partialPath, backupPath);
    } catch {
      removeQuietly(partialPath);
      removeQuietly(restorePath);
      return { ok: false, reason: "copy_failed" };
    }
    return { ok: true, backupPath, restoredValue };
  } catch {
    if (restored) restored.close();
    removeQuietly(partialPath);
    removeQuietly(restorePath);
    return { ok: false, reason: "restore_failed" };
  }
}
