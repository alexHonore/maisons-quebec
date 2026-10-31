import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import {
  NATIVE_EVENTS,
  parseEventDefinition,
  type NativeEventType,
} from "../domain/event-catalog";

export type EventDefinitionView = {
  readonly id: string;
  readonly name: string;
  readonly trigger: string;
  readonly schemaVersion: string;
  readonly funnelName: string | null;
  readonly enabled: boolean;
  readonly observedCount: number;
};

export type EventTrace = {
  readonly id: string;
  readonly eventType: string;
  readonly status: string;
  readonly createdAt: string;
  readonly leadId: string;
};

export function saveEventDefinition(
  db: DatabaseSync,
  input: {
    actorId: string;
    actorRole: AdminRole;
    name: string;
    trigger: string;
    schemaVersion: string;
    funnelName?: string | null;
    consentRequired?: boolean;
    now: Date;
  },
): { ok: true; id: string } | { ok: false; reason: "forbidden" | "invalid_name" | "invalid_trigger" | "invalid_version" | "invalid_funnel" | "consent_locked" | "duplicate_name" } {
  if (!roleCan(input.actorRole, "events.manage")) return { ok: false, reason: "forbidden" };
  const parsed = parseEventDefinition(input);
  if (!parsed.ok) return parsed;
  const id = randomUUID();
  try {
    db.prepare(
      `INSERT INTO event_definitions (id, name, trigger_event, schema_version, funnel_name, enabled, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ).run(
      id,
      parsed.definition.name,
      parsed.definition.trigger,
      parsed.definition.schemaVersion,
      parsed.definition.funnelName,
      input.now.toISOString(),
    );
  } catch (error) {
    if (error instanceof Error && error.message.includes("UNIQUE constraint failed")) {
      return { ok: false, reason: "duplicate_name" };
    }
    throw error;
  }
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "event.definition_saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id };
}

export function setEventDefinitionEnabled(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; id: string; enabled: boolean; now: Date },
): { ok: true } | { ok: false; reason: "forbidden" | "missing" } {
  if (!roleCan(input.actorRole, "events.manage")) return { ok: false, reason: "forbidden" };
  const updated = db.prepare("UPDATE event_definitions SET enabled = ? WHERE id = ?").run(input.enabled ? 1 : 0, input.id);
  if (updated.changes !== 1) return { ok: false, reason: "missing" };
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.enabled ? "event.definition_enabled" : "event.definition_disabled",
    subjectId: input.id,
    at: input.now,
  });
  return { ok: true };
}

export function listEventDefinitions(db: DatabaseSync): EventDefinitionView[] {
  const counts = new Map<string, number>();
  for (const row of db.prepare("SELECT event_type, COUNT(*) AS total FROM lead_outbox GROUP BY event_type").all()) {
    counts.set(String(row.event_type), Number(row.total));
  }
  return db
    .prepare("SELECT id, name, trigger_event, schema_version, funnel_name, enabled FROM event_definitions ORDER BY created_at ASC")
    .all()
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      trigger: String(row.trigger_event),
      schemaVersion: String(row.schema_version),
      funnelName: row.funnel_name === null || row.funnel_name === undefined ? null : String(row.funnel_name),
      enabled: Number(row.enabled) === 1,
      observedCount: counts.get(String(row.name)) ?? 0,
    }));
}

export function nativeEventCounts(db: DatabaseSync): Record<NativeEventType, number> {
  const counts = { "lead.created": 0, "appointment.requested": 0, "appointment.confirmed": 0 };
  for (const spec of NATIVE_EVENTS) {
    const row = db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = ?").get(spec.eventType);
    counts[spec.eventType] = Number(row?.total ?? 0);
  }
  return counts;
}

export function listEventTraces(db: DatabaseSync): EventTrace[] {
  return db
    .prepare(
      `SELECT id, event_type, status, created_at, lead_id
       FROM lead_outbox ORDER BY created_at DESC LIMIT 20`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      eventType: String(row.event_type),
      status: String(row.status),
      createdAt: String(row.created_at),
      leadId: String(row.lead_id),
    }));
}

export function enqueueCustomEvents(
  db: DatabaseSync,
  input: {
    trigger: NativeEventType;
    leadId: string;
    funnelName: string;
    sourceEventId: string;
    occurredAt: string;
    consentToRespond: boolean;
  },
): void {
  if (!input.consentToRespond) return;
  const definitions = db
    .prepare(
      `SELECT name, schema_version, funnel_name FROM event_definitions WHERE enabled = 1 AND trigger_event = ?`,
    )
    .all(input.trigger);
  for (const definition of definitions) {
    const funnel = definition.funnel_name === null || definition.funnel_name === undefined ? null : String(definition.funnel_name);
    if (funnel && funnel !== input.funnelName) continue;
    const id = randomUUID();
    const body = JSON.stringify({
      event_id: id,
      event_type: String(definition.name),
      schema_version: String(definition.schema_version),
      occurred_at: input.occurredAt,
      producer: "maisonsquebec.ca",
      payload: {
        source_event: input.trigger,
        source_event_id: input.sourceEventId,
        lead_id: input.leadId,
        funnel_name: input.funnelName,
        consent_to_respond: true,
      },
    });
    db.prepare(
      `INSERT INTO lead_outbox (id, lead_id, event_type, schema_version, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(id, input.leadId, String(definition.name), String(definition.schema_version), body, input.occurredAt);
  }
}
