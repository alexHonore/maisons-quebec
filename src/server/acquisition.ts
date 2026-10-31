import { createHmac, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import {
  appointmentWindow,
  confirmableSlot,
  FUNNEL_CONSENT_VERSION,
  FUNNEL_LEAD_TYPE,
  isHonestFunnelName,
  parseFunnelFields,
  type HonestFunnelName,
} from "../domain/honest-funnels";
import {
  calculateSaleProceeds,
  type SaleProceeds,
  type SaleProceedsInput,
} from "../domain/sale-proceeds";
import { runMatchingAutomations } from "./automations";
import { enqueueCustomEvents } from "./event-catalog";
import { encryptTotpSecret, decryptTotpSecret, totpKeyFromSessionSecret } from "./totp-vault";

export const FUNNEL_NAME = "produit_net";
export const CONSENT_TEXT_VERSION = "reponse-calcul-v1";
export const LEAD_EVENT_TYPE = "lead.created";
export const APPOINTMENT_REQUESTED = "appointment.requested";
export const APPOINTMENT_CONFIRMED = "appointment.confirmed";
export const LEAD_SCHEMA_VERSION = "1.0";
export type AppointmentStatus = "none" | "requested" | "confirmed";

export type LeadVisibility = "full" | "aggregate" | "none";

export function leadVisibility(role: AdminRole): LeadVisibility {
  if (roleCan(role, "leads.read")) return "full";
  if (roleCan(role, "leads.aggregate")) return "aggregate";
  return "none";
}

export function saveNetProceedsDraft(db: DatabaseSync, input: SaleProceedsInput, now = new Date()): string {
  const id = randomUUID();
  db.prepare("INSERT INTO net_proceeds_drafts (id, input_json, created_at) VALUES (?, ?, ?)").run(
    id,
    JSON.stringify(input),
    now.toISOString(),
  );
  return id;
}

export function readNetProceedsDraft(db: DatabaseSync, id: string): { input: SaleProceedsInput; result: SaleProceeds } | null {
  const row = db.prepare("SELECT input_json FROM net_proceeds_drafts WHERE id = ?").get(id);
  if (!row) return null;
  let input: SaleProceedsInput;
  try {
    input = JSON.parse(String(row.input_json)) as SaleProceedsInput;
  } catch {
    return null;
  }
  const result = calculateSaleProceeds(input);
  if (!result.ok) return null;
  return { input, result: result.value };
}

export type LeadCaptureInput = {
  readonly name: string;
  readonly email: string;
  readonly consentToRespond: boolean;
  readonly consentMarketing: boolean;
  readonly draftId: string;
  readonly funnelName?: typeof FUNNEL_NAME | HonestFunnelName;
  readonly requestAppointment?: boolean;
  readonly appointmentWindow?: string;
};

export type LeadCaptureFailure = "consent_required" | "invalid_contact" | "unknown_draft" | "appointment_window_required";

function isUniqueConflict(error: unknown): boolean {
  return error instanceof Error && error.message.includes("UNIQUE constraint failed");
}

function leadCreatedBody(input: {
  eventId: string;
  occurredAt: string;
  leadId: string;
  leadType: "vendeur" | "acheteur";
  funnelName: string;
  name: string;
  email: string;
  consentMarketing: boolean;
  consentVersion: string;
}): string {
  return JSON.stringify({
    event_id: input.eventId,
    event_type: LEAD_EVENT_TYPE,
    schema_version: LEAD_SCHEMA_VERSION,
    occurred_at: input.occurredAt,
    producer: "maisonsquebec.ca",
    payload: {
      lead_id: input.leadId,
      lead_type: input.leadType,
      funnel_name: input.funnelName,
      contact_name: input.name,
      contact_email: input.email,
      consent_to_respond: true,
      consent_marketing: input.consentMarketing,
      consent_text_version: input.consentVersion,
    },
  });
}

function appointmentBody(input: {
  eventId: string;
  eventType: typeof APPOINTMENT_REQUESTED | typeof APPOINTMENT_CONFIRMED;
  occurredAt: string;
  leadId: string;
  appointmentId: string;
  funnelName: string;
  detailKey: "window_text" | "confirmed_slot";
  detail: string;
}): string {
  return JSON.stringify({
    event_id: input.eventId,
    event_type: input.eventType,
    schema_version: LEAD_SCHEMA_VERSION,
    occurred_at: input.occurredAt,
    producer: "maisonsquebec.ca",
    payload: {
      lead_id: input.leadId,
      appointment_id: input.appointmentId,
      funnel_name: input.funnelName,
      [input.detailKey]: input.detail,
    },
  });
}

export function saveFunnelDraft(
  db: DatabaseSync,
  draft: { funnelName: HonestFunnelName; answers: { readonly [key: string]: string } },
  now = new Date(),
): string {
  const id = randomUUID();
  db.prepare("INSERT INTO funnel_drafts (id, funnel_name, answers_json, created_at) VALUES (?, ?, ?, ?)").run(
    id,
    draft.funnelName,
    JSON.stringify(draft.answers),
    now.toISOString(),
  );
  return id;
}

export function readFunnelDraft(
  db: DatabaseSync,
  funnelName: HonestFunnelName,
  id: string,
): { funnelName: HonestFunnelName; answers: { [key: string]: string } } | null {
  const row = db.prepare("SELECT funnel_name, answers_json FROM funnel_drafts WHERE id = ?").get(id);
  if (!row || String(row.funnel_name) !== funnelName) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(String(row.answers_json));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const answers: { [key: string]: string } = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value !== "string") return null;
    answers[key] = value;
  }
  const checked = parseFunnelFields(funnelName, answers);
  if (!checked.ok) return null;
  return checked.draft;
}

function insertRequestedAppointment(
  db: DatabaseSync,
  input: { leadId: string; funnelName: string; window: string; occurredAt: string },
): string {
  const appointmentId = randomUUID();
  const appointmentEventId = randomUUID();
  db.prepare(
    `INSERT INTO appointments (id, lead_id, status, window_text, confirmed_slot, requested_at, confirmed_at, confirmed_by)
     VALUES (?, ?, 'requested', ?, NULL, ?, NULL, NULL)`,
  ).run(appointmentId, input.leadId, input.window, input.occurredAt);
  db.prepare(
    `INSERT INTO lead_outbox (id, lead_id, event_type, schema_version, body, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
  ).run(
    appointmentEventId,
    input.leadId,
    APPOINTMENT_REQUESTED,
    LEAD_SCHEMA_VERSION,
    appointmentBody({
      eventId: appointmentEventId,
      eventType: APPOINTMENT_REQUESTED,
      occurredAt: input.occurredAt,
      leadId: input.leadId,
      appointmentId,
      funnelName: input.funnelName,
      detailKey: "window_text",
      detail: input.window,
    }),
    input.occurredAt,
  );
  enqueueCustomEvents(db, {
    trigger: APPOINTMENT_REQUESTED,
    leadId: input.leadId,
    funnelName: input.funnelName,
    sourceEventId: appointmentEventId,
    occurredAt: input.occurredAt,
    consentToRespond: true,
  });
  runMatchingAutomations(db, {
    trigger: APPOINTMENT_REQUESTED,
    sourceEventId: appointmentEventId,
    occurredAt: input.occurredAt,
  });
  return appointmentEventId;
}

function resolveExistingLead(
  db: DatabaseSync,
  input: { leadId: string; funnelName: string; requestAppointment: boolean; window: string | null; occurredAt: string },
): { ok: true; leadId: string; outboxId: string | null; duplicate: true; appointmentAdded: boolean } | { ok: false; reason: "appointment_window_required" | "consent_required" } {
  const lead = db.prepare("SELECT consent_to_respond FROM leads WHERE id = ?").get(input.leadId);
  if (Number(lead?.consent_to_respond) !== 1) return { ok: false, reason: "consent_required" };
  if (!input.requestAppointment) {
    return { ok: true, leadId: input.leadId, outboxId: null, duplicate: true, appointmentAdded: false };
  }
  const existingAppointment = db.prepare("SELECT id FROM appointments WHERE lead_id = ?").get(input.leadId);
  if (existingAppointment) {
    return { ok: true, leadId: input.leadId, outboxId: null, duplicate: true, appointmentAdded: false };
  }
  if (!input.window) return { ok: false, reason: "appointment_window_required" };
  const outboxId = insertRequestedAppointment(db, {
    leadId: input.leadId,
    funnelName: input.funnelName,
    window: input.window,
    occurredAt: input.occurredAt,
  });
  return { ok: true, leadId: input.leadId, outboxId, duplicate: true, appointmentAdded: true };
}

export function captureLead(
  db: DatabaseSync,
  input: LeadCaptureInput,
  now = new Date(),
): { ok: true; leadId: string; outboxId: string | null; duplicate: boolean; appointmentAdded: boolean } | { ok: false; reason: LeadCaptureFailure } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!input.consentToRespond) return { ok: false, reason: "consent_required" };
  if (name.length < 2 || name.length > 80 || !/^[^@\s]+@[^@\s]+$/.test(email) || email.length > 120) {
    return { ok: false, reason: "invalid_contact" };
  }

  const funnelName = input.funnelName ?? FUNNEL_NAME;
  let leadType: "vendeur" | "acheteur" = "vendeur";
  let consentVersion = CONSENT_TEXT_VERSION;
  let answersJson: string | null = null;
  if (funnelName === FUNNEL_NAME) {
    if (!readNetProceedsDraft(db, input.draftId)) return { ok: false, reason: "unknown_draft" };
  } else if (isHonestFunnelName(funnelName)) {
    const draft = readFunnelDraft(db, funnelName, input.draftId);
    if (!draft) return { ok: false, reason: "unknown_draft" };
    leadType = FUNNEL_LEAD_TYPE[funnelName];
    consentVersion = FUNNEL_CONSENT_VERSION[funnelName];
    answersJson = JSON.stringify(draft.answers);
  } else {
    return { ok: false, reason: "unknown_draft" };
  }

  const leadId = randomUUID();
  const outboxId = randomUUID();
  const occurredAt = now.toISOString();
  const body = leadCreatedBody({
    eventId: outboxId,
    occurredAt,
    leadId,
    leadType,
    funnelName,
    name,
    email,
    consentMarketing: input.consentMarketing,
    consentVersion,
  });
  const window = input.requestAppointment ? appointmentWindow(input.appointmentWindow ?? "") : null;

  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db
      .prepare("SELECT id FROM leads WHERE contact_email = ? AND funnel_name = ?")
      .get(email, funnelName);
    if (existing) {
      const resolved = resolveExistingLead(db, {
        leadId: String(existing.id),
        funnelName,
        requestAppointment: Boolean(input.requestAppointment),
        window,
        occurredAt,
      });
      if (!resolved.ok) {
        db.exec("ROLLBACK");
        return resolved;
      }
      db.exec("COMMIT");
      return resolved;
    }
    if (input.requestAppointment && !window) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "appointment_window_required" };
    }
    db.prepare(
      `INSERT INTO leads (
         id, created_at, contact_name, contact_email, consent_to_respond, consent_marketing,
         consent_text_version, funnel_name, draft_id, delivery_status
       ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'pending')`,
    ).run(leadId, occurredAt, name, email, input.consentMarketing ? 1 : 0, consentVersion, funnelName, input.draftId);
    db.prepare(
      `INSERT INTO lead_outbox (id, lead_id, event_type, schema_version, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(outboxId, leadId, LEAD_EVENT_TYPE, LEAD_SCHEMA_VERSION, body, occurredAt);
    enqueueCustomEvents(db, {
      trigger: LEAD_EVENT_TYPE,
      leadId,
      funnelName,
      sourceEventId: outboxId,
      occurredAt,
      consentToRespond: true,
    });
    runMatchingAutomations(db, {
      trigger: LEAD_EVENT_TYPE,
      sourceEventId: outboxId,
      occurredAt,
    });
    if (answersJson) {
      db.prepare(
        `INSERT INTO funnel_answers (id, lead_id, funnel_name, answers_json, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).run(randomUUID(), leadId, funnelName, answersJson, occurredAt);
    }
    if (window) insertRequestedAppointment(db, { leadId, funnelName, window, occurredAt });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    if (isUniqueConflict(error)) {
      return settleDuplicateAfterConflict(db, { email, funnelName, requestAppointment: Boolean(input.requestAppointment), window, occurredAt });
    }
    throw error;
  }
  return { ok: true, leadId, outboxId, duplicate: false, appointmentAdded: false };
}

function settleDuplicateAfterConflict(
  db: DatabaseSync,
  input: { email: string; funnelName: string; requestAppointment: boolean; window: string | null; occurredAt: string },
): { ok: true; leadId: string; outboxId: string | null; duplicate: true; appointmentAdded: boolean } | { ok: false; reason: "appointment_window_required" | "consent_required" } {
  db.exec("BEGIN IMMEDIATE");
  try {
    const existing = db.prepare("SELECT id FROM leads WHERE contact_email = ? AND funnel_name = ?").get(input.email, input.funnelName);
    if (!existing) throw new Error("Doublon introuvable.");
    const resolved = resolveExistingLead(db, {
      leadId: String(existing.id),
      funnelName: input.funnelName,
      requestAppointment: input.requestAppointment,
      window: input.window,
      occurredAt: input.occurredAt,
    });
    if (!resolved.ok) {
      db.exec("ROLLBACK");
      return resolved;
    }
    db.exec("COMMIT");
    return resolved;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function confirmAppointment(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; leadId: string; slot: string; now: Date },
): { ok: true; outboxId: string } | { ok: false; reason: "forbidden" | "not_requested" | "invalid_slot" | "already_confirmed" } {
  if (!roleCan(input.actorRole, "appointments.confirm")) return { ok: false, reason: "forbidden" };
  const confirmed = confirmableSlot(input.slot);
  if (!confirmed) return { ok: false, reason: "invalid_slot" };
  const appointment = db
    .prepare("SELECT id, status FROM appointments WHERE lead_id = ?")
    .get(input.leadId);
  if (!appointment) return { ok: false, reason: "not_requested" };
  if (String(appointment.status) === "confirmed") return { ok: false, reason: "already_confirmed" };
  if (String(appointment.status) !== "requested") return { ok: false, reason: "not_requested" };
  const lead = db.prepare("SELECT funnel_name, consent_to_respond FROM leads WHERE id = ?").get(input.leadId);
  if (!lead) return { ok: false, reason: "not_requested" };

  const outboxId = randomUUID();
  const occurredAt = input.now.toISOString();
  const appointmentId = String(appointment.id);
  db.exec("BEGIN IMMEDIATE");
  try {
    const current = db.prepare("SELECT status FROM appointments WHERE id = ?").get(appointmentId);
    if (!current || String(current.status) !== "requested") {
      db.exec("ROLLBACK");
      return { ok: false, reason: String(current?.status) === "confirmed" ? "already_confirmed" : "not_requested" };
    }
    const updated = db
      .prepare(
        `UPDATE appointments SET status = 'confirmed', confirmed_slot = ?, confirmed_at = ?, confirmed_by = ? WHERE id = ? AND status = 'requested'`,
      )
      .run(confirmed, occurredAt, input.actorId, appointmentId);
    if (updated.changes !== 1) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "already_confirmed" };
    }
    db.prepare(
      `INSERT INTO lead_outbox (id, lead_id, event_type, schema_version, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(
      outboxId,
      input.leadId,
      APPOINTMENT_CONFIRMED,
      LEAD_SCHEMA_VERSION,
      appointmentBody({
        eventId: outboxId,
        eventType: APPOINTMENT_CONFIRMED,
        occurredAt,
        leadId: input.leadId,
        appointmentId,
        funnelName: String(lead.funnel_name),
        detailKey: "confirmed_slot",
        detail: confirmed,
      }),
      occurredAt,
    );
    enqueueCustomEvents(db, {
      trigger: APPOINTMENT_CONFIRMED,
      leadId: input.leadId,
      funnelName: String(lead.funnel_name),
      sourceEventId: outboxId,
      occurredAt,
      consentToRespond: Number(lead.consent_to_respond) === 1,
    });
    runMatchingAutomations(db, {
      trigger: APPOINTMENT_CONFIRMED,
      sourceEventId: outboxId,
      occurredAt,
    });
    recordAdminAudit(db, {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: "appointment.confirmed",
      subjectId: appointmentId,
      at: input.now,
    });
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, outboxId };
}

export type LeadAggregate = {
  readonly id: string;
  readonly createdAt: string;
  readonly funnelName: string;
  readonly deliveryStatus: "pending" | "delivered";
  readonly consentToRespond: boolean;
  readonly consentMarketing: boolean;
  readonly appointmentStatus: AppointmentStatus;
};

export type LeadRecord = LeadAggregate & {
  readonly name: string;
  readonly email: string;
  readonly appointmentWindow: string | null;
  readonly confirmedSlot: string | null;
};

function appointmentStatusOf(value: unknown): AppointmentStatus {
  if (value === "requested" || value === "confirmed") return value;
  return "none";
}

export function listLeadAggregates(db: DatabaseSync): LeadAggregate[] {
  return db
    .prepare(
      `SELECT leads.id, leads.created_at, leads.funnel_name, leads.delivery_status,
              leads.consent_to_respond, leads.consent_marketing, appointments.status AS appointment_status
       FROM leads
       LEFT JOIN appointments ON appointments.lead_id = leads.id
       ORDER BY leads.created_at DESC`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      funnelName: String(row.funnel_name),
      deliveryStatus: row.delivery_status === "delivered" ? "delivered" : "pending",
      consentToRespond: Number(row.consent_to_respond) === 1,
      consentMarketing: Number(row.consent_marketing) === 1,
      appointmentStatus: appointmentStatusOf(row.appointment_status),
    }));
}

export function listLeadsForOwner(db: DatabaseSync): LeadRecord[] {
  return db
    .prepare(
      `SELECT leads.id, leads.created_at, leads.funnel_name, leads.delivery_status,
              leads.consent_to_respond, leads.consent_marketing, leads.contact_name, leads.contact_email,
              appointments.status AS appointment_status, appointments.window_text, appointments.confirmed_slot
       FROM leads
       LEFT JOIN appointments ON appointments.lead_id = leads.id
       ORDER BY leads.created_at DESC`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      funnelName: String(row.funnel_name),
      deliveryStatus: row.delivery_status === "delivered" ? "delivered" : "pending",
      consentToRespond: Number(row.consent_to_respond) === 1,
      consentMarketing: Number(row.consent_marketing) === 1,
      appointmentStatus: appointmentStatusOf(row.appointment_status),
      name: String(row.contact_name),
      email: String(row.contact_email),
      appointmentWindow: row.window_text === null || row.window_text === undefined ? null : String(row.window_text),
      confirmedSlot: row.confirmed_slot === null || row.confirmed_slot === undefined ? null : String(row.confirmed_slot),
    }));
}

export function deliveryLabel(status: "pending" | "delivered"): "en attente" | "livré" {
  return status === "delivered" ? "livré" : "en attente";
}

export function validateWebhookUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (url.protocol !== "https:") return null;
    if (url.username !== "" || url.password !== "") return null;
    const host = url.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local") || host === "127.0.0.1" || host === "::1") return null;
    return url.toString();
  } catch {
    return null;
  }
}

export function signWebhook(secret: string, timestamp: string, body: string): string {
  return createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export type DestinationView = {
  readonly id: string;
  readonly name: string;
  readonly url: string;
  readonly enabled: boolean;
  readonly secretStored: true;
};

export function saveWebhookDestination(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; name: string; url: string; secret: string; sessionSecret: string; now: Date },
): { ok: true; id: string } | { ok: false; reason: "forbidden" | "invalid_url" | "invalid_secret" | "key_missing" } {
  if (!roleCan(input.actorRole, "webhooks.manage")) return { ok: false, reason: "forbidden" };
  const url = validateWebhookUrl(input.url);
  if (!url) return { ok: false, reason: "invalid_url" };
  if (input.secret.trim().length < 16) return { ok: false, reason: "invalid_secret" };
  const key = totpKeyFromSessionSecret(input.sessionSecret);
  if (!key) return { ok: false, reason: "key_missing" };
  const id = randomUUID();
  db.prepare(
    `INSERT INTO webhook_destinations (id, name, url, secret_ciphertext, enabled, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).run(id, input.name.trim().slice(0, 80), url, encryptTotpSecret(new TextEncoder().encode(input.secret), key), input.now.toISOString());
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "webhook.destination_saved",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, id };
}

export function listWebhookDestinations(db: DatabaseSync): DestinationView[] {
  return db
    .prepare("SELECT id, name, url, enabled FROM webhook_destinations ORDER BY created_at ASC")
    .all()
    .map((row) => ({
      id: String(row.id),
      name: String(row.name),
      url: String(row.url),
      enabled: Number(row.enabled) === 1,
      secretStored: true,
    }));
}

export type WebhookTransport = (input: {
  url: string;
  body: string;
  headers: Record<string, string>;
}) => Promise<{ status: number }>;

export async function dispatchPendingOutbox(
  db: DatabaseSync,
  input: { now: Date; transport: WebhookTransport; sessionSecret: string },
): Promise<{ delivered: number; failed: number; waiting: number }> {
  const destinations = db
    .prepare("SELECT id, url, secret_ciphertext FROM webhook_destinations WHERE enabled = 1")
    .all();
  const pending = db.prepare("SELECT id, lead_id, body FROM lead_outbox WHERE status = 'pending'").all();
  if (destinations.length === 0) return { delivered: 0, failed: 0, waiting: pending.length };

  const key = totpKeyFromSessionSecret(input.sessionSecret);
  let delivered = 0;
  let failed = 0;
  for (const event of pending) {
    let oneSucceeded = false;
    for (const destination of destinations) {
      const secretBytes = key ? decryptTotpSecret(String(destination.secret_ciphertext), key) : null;
      const secret = secretBytes ? new TextDecoder().decode(secretBytes) : "";
      const body = String(event.body);
      const timestamp = input.now.toISOString();
      let httpStatus: number | null = null;
      let outcome: "succeeded" | "failed" = "failed";
      let errorCode = "reseau";
      if (secret === "") {
        errorCode = "secret_illisible";
      } else {
        try {
          const response = await input.transport({
            url: String(destination.url),
            body,
            headers: {
              "content-type": "application/json",
              "x-maisons-timestamp": timestamp,
              "x-maisons-signature": signWebhook(secret, timestamp, body),
            },
          });
          httpStatus = response.status;
          if (response.status >= 200 && response.status < 300) {
            outcome = "succeeded";
            errorCode = "ok";
            oneSucceeded = true;
          } else {
            errorCode = "http";
          }
        } catch {
          errorCode = "reseau";
        }
      }
      db.prepare(
        `INSERT INTO webhook_attempts (id, outbox_id, destination_id, attempted_at, http_status, outcome, error_code)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(randomUUID(), String(event.id), String(destination.id), input.now.toISOString(), httpStatus, outcome, errorCode);
      if (outcome === "failed") failed += 1;
    }
    if (oneSucceeded) {
      db.prepare("UPDATE lead_outbox SET status = 'delivered' WHERE id = ?").run(String(event.id));
      db.prepare("UPDATE leads SET delivery_status = 'delivered' WHERE id = ?").run(String(event.lead_id));
      delivered += 1;
    }
  }
  const stillWaiting = db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE status = 'pending'").get();
  return { delivered, failed, waiting: Number(stillWaiting?.total ?? 0) };
}

export function attemptsPlainText(db: DatabaseSync): string {
  return db
    .prepare("SELECT outbox_id, destination_id, http_status, outcome, error_code FROM webhook_attempts")
    .all()
    .map((row) => Object.values(row).join(" "))
    .join("\n");
}
