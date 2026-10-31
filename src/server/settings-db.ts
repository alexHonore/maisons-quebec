import { mkdirSync } from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";

export const SETTING_KEYS = [
  "brand_name",
  "hero_title",
  "hero_promise",
  "hero_subpromise",
  "broker_oaciq_permit",
  "agency_name",
  "agency_permit",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

const REGULATORY_KEYS = new Set<SettingKey>(["broker_oaciq_permit", "agency_name", "agency_permit"]);

export const MIGRATIONS = [
  {
    version: "001_site_settings",
    up: `
      CREATE TABLE site_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS site_settings;",
  },
] as const;

export function settingsFilePath(env: { readonly [key: string]: string | undefined }): string {
  const configured = env.SITE_SETTINGS_PATH?.trim();
  if (configured) return configured;
  return path.join(process.cwd(), "data", "site-settings.sqlite");
}

function ensureMigrationsTable(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
}

function appliedVersions(db: DatabaseSync): string[] {
  ensureMigrationsTable(db);
  return db
    .prepare("SELECT version FROM schema_migrations ORDER BY version ASC")
    .all()
    .map((row) => String(row.version));
}

export function migrateUp(db: DatabaseSync, now = new Date()): void {
  ensureMigrationsTable(db);
  const applied = new Set(appliedVersions(db));
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    db.exec(migration.up);
    db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
      migration.version,
      now.toISOString(),
    );
  }
}

export function migrateDown(db: DatabaseSync): void {
  const applied = appliedVersions(db);
  for (const version of [...applied].reverse()) {
    const migration = MIGRATIONS.find((item) => item.version === version);
    if (!migration) throw new Error(`Migration inconnue : ${version}`);
    db.exec(migration.down);
    db.prepare("DELETE FROM schema_migrations WHERE version = ?").run(version);
  }
  db.exec("DROP TABLE IF EXISTS schema_migrations;");
}

export function openSettingsDatabase(filePath: string): DatabaseSync {
  if (filePath !== ":memory:") {
    mkdirSync(path.dirname(filePath), { recursive: true });
  }
  const db = new DatabaseSync(filePath);
  migrateUp(db);
  return db;
}

export function readStoredSettings(db: DatabaseSync): Record<SettingKey, string> {
  const stored = Object.fromEntries(SETTING_KEYS.map((key) => [key, ""])) as Record<SettingKey, string>;
  const rows = db.prepare("SELECT key, value FROM site_settings").all();
  for (const row of rows) {
    const key = String(row.key);
    if ((SETTING_KEYS as readonly string[]).includes(key)) {
      stored[key as SettingKey] = String(row.value);
    }
  }
  return stored;
}

export function saveSettings(
  db: DatabaseSync,
  values: Partial<Record<SettingKey, string>>,
  now = new Date(),
): { ok: true } | { ok: false; errors: readonly string[] } {
  const errors: string[] = [];
  const normalized = new Map<SettingKey, string>();
  for (const [key, raw] of Object.entries(values)) {
    if (!(SETTING_KEYS as readonly string[]).includes(key)) {
      errors.push(`Champ refusé : ${key}`);
      continue;
    }
    const settingKey = key as SettingKey;
    const trimmed = (raw ?? "").trim();
    const value = trimmed === REGULATORY_EMPTY_LABEL ? "" : trimmed;
    const limit = REGULATORY_KEYS.has(settingKey) ? 120 : 600;
    if (value.length > limit) {
      errors.push(`Champ trop long : ${settingKey}`);
      continue;
    }
    normalized.set(settingKey, value);
  }
  if (errors.length > 0) return { ok: false, errors };

  const statement = db.prepare(
    `INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
  );
  const stamp = now.toISOString();
  for (const [key, value] of normalized) {
    statement.run(key, value, stamp);
  }
  return { ok: true };
}
