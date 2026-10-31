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
  {
    version: "002_admin_users",
    up: `
      CREATE TABLE admin_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'analyst', 'integration_manager', 'automation_manager')),
        disabled INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
        created_at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS admin_users;",
  },
  {
    version: "003_job_runs",
    up: `
      CREATE TABLE job_runs (
        id TEXT PRIMARY KEY,
        job_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('succeeded', 'failed')),
        actor_role TEXT NOT NULL CHECK (actor_role IN ('owner', 'editor', 'analyst', 'integration_manager', 'automation_manager')),
        started_at TEXT NOT NULL,
        finished_at TEXT NOT NULL,
        summary TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS job_runs;",
  },
  {
    version: "004_admin_totp",
    up: `
      CREATE TABLE admin_totp (
        user_id TEXT PRIMARY KEY,
        secret_ciphertext TEXT NOT NULL,
        confirmed INTEGER NOT NULL DEFAULT 0 CHECK (confirmed IN (0, 1)),
        created_at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS admin_totp;",
  },
  {
    version: "005_job_queue",
    up: `
      CREATE TABLE job_queue (
        id TEXT PRIMARY KEY,
        job_name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
        attempts INTEGER NOT NULL,
        max_attempts INTEGER NOT NULL,
        actor_role TEXT NOT NULL CHECK (actor_role IN ('owner', 'editor', 'analyst', 'integration_manager', 'automation_manager')),
        available_at TEXT NOT NULL,
        last_error TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS job_queue;",
  },
  {
    version: "006_admin_audit",
    up: `
      CREATE TABLE admin_audit (
        id TEXT PRIMARY KEY,
        actor_id TEXT NOT NULL,
        actor_role TEXT NOT NULL,
        action TEXT NOT NULL,
        subject_id TEXT,
        at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS admin_audit;",
  },
  {
    version: "007_leads_outbox",
    up: `
      CREATE TABLE net_proceeds_drafts (
        id TEXT PRIMARY KEY,
        input_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE leads (
        id TEXT PRIMARY KEY,
        created_at TEXT NOT NULL,
        contact_name TEXT NOT NULL,
        contact_email TEXT NOT NULL,
        consent_to_respond INTEGER NOT NULL CHECK (consent_to_respond IN (0, 1)),
        consent_marketing INTEGER NOT NULL CHECK (consent_marketing IN (0, 1)),
        consent_text_version TEXT NOT NULL,
        funnel_name TEXT NOT NULL,
        draft_id TEXT,
        delivery_status TEXT NOT NULL CHECK (delivery_status IN ('pending', 'delivered'))
      );
      CREATE TABLE lead_outbox (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending', 'delivered')),
        created_at TEXT NOT NULL
      );
      CREATE TABLE webhook_destinations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        secret_ciphertext TEXT NOT NULL,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL
      );
      CREATE TABLE webhook_attempts (
        id TEXT PRIMARY KEY,
        outbox_id TEXT NOT NULL,
        destination_id TEXT NOT NULL,
        attempted_at TEXT NOT NULL,
        http_status INTEGER,
        outcome TEXT NOT NULL CHECK (outcome IN ('succeeded', 'failed')),
        error_code TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS webhook_attempts;
      DROP TABLE IF EXISTS lead_outbox;
      DROP TABLE IF EXISTS webhook_destinations;
      DROP TABLE IF EXISTS leads;
      DROP TABLE IF EXISTS net_proceeds_drafts;
    `,
  },
  {
    version: "008_funnels_appointments",
    up: `
      CREATE TABLE funnel_drafts (
        id TEXT PRIMARY KEY,
        funnel_name TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE funnel_answers (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL,
        funnel_name TEXT NOT NULL,
        answers_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE appointments (
        id TEXT PRIMARY KEY,
        lead_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed')),
        window_text TEXT NOT NULL,
        confirmed_slot TEXT,
        requested_at TEXT NOT NULL,
        confirmed_at TEXT,
        confirmed_by TEXT
      );
      CREATE UNIQUE INDEX leads_dedup_email_funnel ON leads (contact_email, funnel_name);
    `,
    down: `
      DROP INDEX IF EXISTS leads_dedup_email_funnel;
      DROP TABLE IF EXISTS appointments;
      DROP TABLE IF EXISTS funnel_answers;
      DROP TABLE IF EXISTS funnel_drafts;
    `,
  },
  {
    version: "009_event_definitions",
    up: `
      CREATE TABLE event_definitions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        trigger_event TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        funnel_name TEXT,
        enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
        created_at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS event_definitions;",
  },
  {
    version: "010_content_pages",
    up: `
      CREATE TABLE content_pages (
        id TEXT PRIMARY KEY,
        slug TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        source_note TEXT NOT NULL,
        example INTEGER NOT NULL CHECK (example IN (0, 1)),
        status TEXT NOT NULL CHECK (status IN ('draft', 'published')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      );
    `,
    down: "DROP TABLE IF EXISTS content_pages;",
  },
  {
    version: "011_content_versions",
    up: `
      CREATE TABLE content_versions (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        slug TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        body TEXT NOT NULL,
        source_note TEXT NOT NULL,
        example INTEGER NOT NULL CHECK (example IN (0, 1)),
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        restored_from INTEGER,
        UNIQUE (page_id, version_number)
      );
    `,
    down: "DROP TABLE IF EXISTS content_versions;",
  },
  {
    version: "012_editorial_scores_prompts",
    up: `
      CREATE TABLE prompt_layers (
        id TEXT PRIMARY KEY,
        layer TEXT NOT NULL CHECK (layer IN ('L1', 'L2')),
        version_number INTEGER NOT NULL,
        body TEXT NOT NULL,
        created_at TEXT NOT NULL,
        created_by TEXT NOT NULL,
        UNIQUE (layer, version_number)
      );
      CREATE TABLE content_score_runs (
        id TEXT PRIMARY KEY,
        page_id TEXT NOT NULL,
        rubric_version TEXT NOT NULL,
        seo_score INTEGER NOT NULL,
        citability_score INTEGER NOT NULL,
        conversion_score INTEGER NOT NULL,
        passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
        created_at TEXT NOT NULL
      );
    `,
    down: `
      DROP TABLE IF EXISTS content_score_runs;
      DROP TABLE IF EXISTS prompt_layers;
    `,
  },
  {
    version: "013_page_views",
    up: `
      CREATE TABLE page_views (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        occurred_at TEXT NOT NULL
      );
    `,
    down: "DROP TABLE IF EXISTS page_views;",
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
