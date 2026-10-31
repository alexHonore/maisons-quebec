import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";

export const AUDIT_ACTIONS = [
  "session.opened",
  "account.created",
  "account.disabled",
  "settings.updated",
  "totp.enrollment_started",
  "totp.confirmed",
  "job.enqueued",
  "job.executed",
  "job.failed",
  "job.retried",
  "webhook.destination_saved",
  "appointment.confirmed",
  "event.definition_saved",
  "event.definition_disabled",
  "event.definition_enabled",
  "content.saved",
  "content.published",
  "content.unpublished",
  "content.version_restored",
  "prompt.layer_saved",
  "automation.saved",
  "automation.enabled",
  "automation.disabled",
  "media.saved",
  "media.attached",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditEvent = {
  readonly id: string;
  readonly actorId: string;
  readonly actorRole: AdminRole;
  readonly action: AuditAction;
  readonly subjectId: string | null;
  readonly at: string;
};

function isAction(value: string): value is AuditAction {
  return (AUDIT_ACTIONS as readonly string[]).includes(value);
}

export function recordAdminAudit(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; action: AuditAction; subjectId?: string | null; at: Date },
): void {
  if (!isAction(input.action)) throw new Error("Action d'audit refusée.");
  db.prepare(
    `INSERT INTO admin_audit (id, actor_id, actor_role, action, subject_id, at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(randomUUID(), input.actorId, input.actorRole, input.action, input.subjectId ?? null, input.at.toISOString());
}

export function listAdminAudit(db: DatabaseSync): AuditEvent[] {
  return db
    .prepare("SELECT id, actor_id, actor_role, action, subject_id, at FROM admin_audit ORDER BY at ASC, id ASC")
    .all()
    .map((row) => ({
      id: String(row.id),
      actorId: String(row.actor_id),
      actorRole: String(row.actor_role) as AdminRole,
      action: String(row.action) as AuditAction,
      subjectId: row.subject_id === null || row.subject_id === undefined ? null : String(row.subject_id),
      at: String(row.at),
    }));
}

export function auditPlainText(db: DatabaseSync): string {
  return listAdminAudit(db)
    .map((event) => [event.action, event.actorId, event.actorRole, event.subjectId ?? "", event.at].join(" "))
    .join("\n");
}
