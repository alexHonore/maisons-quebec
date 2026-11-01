import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import {
  AUTOMATION_TASK_NAME,
  dryRunAutomation,
  isAutomationAction,
  parseAutomation,
  parseAutomationDocument,
  renderAutomationJson,
  type AutomationAction,
  type AutomationDocumentFailure,
  type AutomationRunState,
} from "../domain/automation";
import { isNativeEventType, type NativeEventType } from "../domain/event-catalog";
import { openDraftFromPublishedPage } from "./content-pages";
import { enqueueJob } from "./job-queue";

export type AutomationView = {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly action: AutomationAction;
  readonly page: string | null;
  readonly enabled: boolean;
  readonly versionNumber: number;
};

export type AutomationVersionView = {
  readonly automationId: string;
  readonly versionNumber: number;
  readonly trigger: string;
  readonly action: string;
  readonly createdAt: string;
};

export type AutomationRunView = {
  readonly trigger: string;
  readonly action: string;
  readonly state: AutomationRunState;
  readonly createdAt: string;
};

function isRunState(value: string): value is AutomationRunState {
  return value === "en_file" || value === "aucune_destination" || value === "tache_en_file" || value === "brouillon_ouvert" || value === "page_introuvable";
}

export function saveAutomation(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; name: string; trigger: string; action: string; page?: string | null; now: Date },
): { ok: true; id: string; versionNumber: number } | { ok: false; reason: "forbidden" | "invalid_name" | "invalid_trigger" | "invalid_action" | "invalid_page" } {
  if (!roleCan(input.actorRole, "automations.manage")) return { ok: false, reason: "forbidden" };
  const parsed = parseAutomation(input);
  if (!parsed.ok) return parsed;
  const now = input.now.toISOString();
  const existing = db.prepare("SELECT id FROM automations WHERE name = ?").get(parsed.definition.name);
  const id = existing ? String(existing.id) : randomUUID();
  const current = db.prepare("SELECT COALESCE(MAX(version_number), 0) AS total FROM automation_versions WHERE automation_id = ?").get(id);
  const versionNumber = Number(current?.total ?? 0) + 1;
  if (!existing) {
    db.prepare(
      `INSERT INTO automations (id, name, trigger_event, action_kind, page_slug, enabled, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
    ).run(id, parsed.definition.name, parsed.definition.trigger, parsed.definition.action, parsed.definition.page, now, now);
  } else {
    db.prepare("UPDATE automations SET trigger_event = ?, action_kind = ?, page_slug = ?, updated_at = ? WHERE id = ?").run(
      parsed.definition.trigger,
      parsed.definition.action,
      parsed.definition.page,
      now,
      id,
    );
  }
  db.prepare(
    `INSERT INTO automation_versions (id, automation_id, version_number, trigger_event, action_kind, page_slug, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), id, versionNumber, parsed.definition.trigger, parsed.definition.action, parsed.definition.page, now, input.actorId);
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "automation.saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id, versionNumber };
}

export function setAutomationEnabled(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; id: string; enabled: boolean; now: Date },
): { ok: true } | { ok: false; reason: "forbidden" | "missing" } {
  if (!roleCan(input.actorRole, "automations.manage")) return { ok: false, reason: "forbidden" };
  const updated = db.prepare("UPDATE automations SET enabled = ?, updated_at = ? WHERE id = ?").run(
    input.enabled ? 1 : 0,
    input.now.toISOString(),
    input.id,
  );
  if (updated.changes !== 1) return { ok: false, reason: "missing" };
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.enabled ? "automation.enabled" : "automation.disabled",
    subjectId: input.id,
    at: input.now,
  });
  return { ok: true };
}

export function listAutomations(db: DatabaseSync): AutomationView[] {
  return db
    .prepare(
      `SELECT automations.id, automations.name, automations.trigger_event, automations.action_kind, automations.page_slug, automations.enabled,
              COALESCE(MAX(automation_versions.version_number), 0) AS version_number
       FROM automations
       LEFT JOIN automation_versions ON automation_versions.automation_id = automations.id
       GROUP BY automations.id
       ORDER BY automations.created_at ASC`,
    )
    .all()
    .map((row) => {
      const actionKind = String(row.action_kind);
      const action: AutomationAction = isAutomationAction(actionKind) ? actionKind : "admin.task";
      return {
        id: String(row.id),
        name: String(row.name),
        trigger: String(row.trigger_event),
        action,
        page: row.page_slug === null || row.page_slug === undefined || String(row.page_slug) === "" ? null : String(row.page_slug),
        enabled: Number(row.enabled) === 1,
        versionNumber: Number(row.version_number),
      };
    });
}

export function listAutomationVersions(db: DatabaseSync): AutomationVersionView[] {
  return db
    .prepare(
      `SELECT automation_id, version_number, trigger_event, action_kind, created_at
       FROM automation_versions ORDER BY automation_id ASC, version_number ASC`,
    )
    .all()
    .map((row) => ({
      automationId: String(row.automation_id),
      versionNumber: Number(row.version_number),
      trigger: String(row.trigger_event),
      action: String(row.action_kind),
      createdAt: String(row.created_at),
    }));
}

export function listAutomationRuns(db: DatabaseSync): AutomationRunView[] {
  return db
    .prepare(
      `SELECT trigger_event, action_kind, state, created_at
       FROM automation_runs ORDER BY created_at DESC LIMIT 20`,
    )
    .all()
    .flatMap((row) => {
      const state = String(row.state);
      if (!isRunState(state)) return [];
      return [{
        trigger: String(row.trigger_event),
        action: String(row.action_kind),
        state,
        createdAt: String(row.created_at),
      }];
    });
}

function recordRun(
  db: DatabaseSync,
  input: {
    automationId: string;
    versionNumber: number;
    sourceEventId: string;
    trigger: NativeEventType;
    action: AutomationAction;
    state: AutomationRunState;
    subjectId: string | null;
    occurredAt: string;
  },
): void {
  db.prepare(
    `INSERT INTO automation_runs (
       id, automation_id, version_number, source_event_id, trigger_event, action_kind, state, subject_id, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    randomUUID(),
    input.automationId,
    input.versionNumber,
    input.sourceEventId,
    input.trigger,
    input.action,
    input.state,
    input.subjectId,
    input.occurredAt,
  );
}

/** Exécute les automatisations actives du déclencheur. N'écrit ni courriel ni état « livré ». */
export function runMatchingAutomations(
  db: DatabaseSync,
  input: { trigger: string; sourceEventId: string; occurredAt: string },
): void {
  if (!isNativeEventType(input.trigger)) return;
  const rows = db
    .prepare("SELECT id, action_kind, page_slug FROM automations WHERE enabled = 1 AND trigger_event = ?")
    .all(input.trigger);
  for (const row of rows) {
    const action = String(row.action_kind);
    if (!isAutomationAction(action)) continue;
    const automationId = String(row.id);
    const version = db
      .prepare("SELECT COALESCE(MAX(version_number), 0) AS total FROM automation_versions WHERE automation_id = ?")
      .get(automationId);
    const versionNumber = Number(version?.total ?? 0);
    if (versionNumber < 1) continue;
    if (action === "webhook.requeue") {
      const destinations = db.prepare("SELECT COUNT(*) AS total FROM webhook_destinations WHERE enabled = 1").get();
      if (Number(destinations?.total ?? 0) === 0) {
        recordRun(db, {
          automationId,
          versionNumber,
          sourceEventId: input.sourceEventId,
          trigger: input.trigger,
          action,
          state: "aucune_destination",
          subjectId: null,
          occurredAt: input.occurredAt,
        });
        continue;
      }
      db.prepare("UPDATE lead_outbox SET status = 'pending' WHERE id = ?").run(input.sourceEventId);
      recordRun(db, {
        automationId,
        versionNumber,
        sourceEventId: input.sourceEventId,
        trigger: input.trigger,
        action,
        state: "en_file",
        subjectId: null,
        occurredAt: input.occurredAt,
      });
      continue;
    }
    if (action === "content.open_draft") {
      const opened = openDraftFromPublishedPage(db, { slug: String(row.page_slug ?? ""), now: new Date(input.occurredAt) });
      recordRun(db, {
        automationId,
        versionNumber,
        sourceEventId: input.sourceEventId,
        trigger: input.trigger,
        action,
        state: opened.ok ? "brouillon_ouvert" : "page_introuvable",
        subjectId: opened.ok ? opened.id : null,
        occurredAt: input.occurredAt,
      });
      continue;
    }
    const job = enqueueJob(db, {
      jobName: AUTOMATION_TASK_NAME,
      actorId: automationId,
      actorRole: "automation_manager",
      now: new Date(input.occurredAt),
    });
    recordRun(db, {
      automationId,
      versionNumber,
      sourceEventId: input.sourceEventId,
      trigger: input.trigger,
      action,
      state: "tache_en_file",
      subjectId: job.id,
      occurredAt: input.occurredAt,
    });
  }
}

function readDefinition(db: DatabaseSync, id: string): { name: string; trigger: string; action: string; page: string | null; enabled: boolean } | null {
  const row = db.prepare("SELECT name, trigger_event, action_kind, page_slug, enabled FROM automations WHERE id = ?").get(id);
  if (!row) return null;
  return {
    name: String(row.name),
    trigger: String(row.trigger_event),
    action: String(row.action_kind),
    page: row.page_slug === null || row.page_slug === undefined || String(row.page_slug) === "" ? null : String(row.page_slug),
    enabled: Number(row.enabled) === 1,
  };
}

export function exportAutomationJson(
  db: DatabaseSync,
  input: { actorRole: AdminRole; id: string },
): { ok: true; filename: string; body: string } | { ok: false; reason: "forbidden" | "missing" } {
  if (!roleCan(input.actorRole, "automations.manage")) return { ok: false, reason: "forbidden" };
  const current = readDefinition(db, input.id);
  if (!current) return { ok: false, reason: "missing" };
  const parsed = parseAutomation(current);
  if (!parsed.ok) return { ok: false, reason: "missing" };
  const document = {
    schema_version: "1.0" as const,
    name: parsed.definition.name,
    trigger: parsed.definition.trigger,
    action: parsed.definition.action,
    page: parsed.definition.page,
  };
  return { ok: true, filename: `automatisation-${document.name}.json`, body: renderAutomationJson(document) };
}

export function importAutomationJson(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; body: string; now: Date },
): { ok: true; id: string; versionNumber: number } | { ok: false; reason: "forbidden" | AutomationDocumentFailure } {
  if (!roleCan(input.actorRole, "automations.manage")) return { ok: false, reason: "forbidden" };
  const parsed = parseAutomationDocument(input.body);
  if (!parsed.ok) return parsed;
  return saveAutomation(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    name: parsed.document.name,
    trigger: parsed.document.trigger,
    action: parsed.document.action,
    page: parsed.document.page,
    now: input.now,
  });
}

export function previewAutomation(
  db: DatabaseSync,
  input: { actorRole: AdminRole; id: string },
): { ok: true; summary: string; requeuedWebhook: false; createdTask: false; openedDraft: false } | { ok: false; reason: "forbidden" | "missing" } {
  if (!roleCan(input.actorRole, "automations.manage")) return { ok: false, reason: "forbidden" };
  const current = readDefinition(db, input.id);
  if (!current) return { ok: false, reason: "missing" };
  const parsed = parseAutomation(current);
  if (!parsed.ok) return { ok: false, reason: "missing" };
  const preview = dryRunAutomation(parsed.definition);
  const summary = current.enabled
    ? preview.summary
    : `Définition inactive. L'essai ne l'active pas. ${preview.summary}`;
  return { ok: true, summary, requeuedWebhook: false, createdTask: false, openedDraft: false };
}
