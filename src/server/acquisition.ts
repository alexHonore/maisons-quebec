import { createHmac, randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { roleCan } from "./admin-permissions";
import {
  calculateSaleProceeds,
  type SaleProceeds,
  type SaleProceedsInput,
} from "../domain/sale-proceeds";
import { encryptTotpSecret, decryptTotpSecret, totpKeyFromSessionSecret } from "./totp-vault";

export const FUNNEL_NAME = "produit_net";
export const CONSENT_TEXT_VERSION = "reponse-calcul-v1";
export const LEAD_EVENT_TYPE = "lead.created";
export const LEAD_SCHEMA_VERSION = "1.0";

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
};

export function captureLead(
  db: DatabaseSync,
  input: LeadCaptureInput,
  now = new Date(),
): { ok: true; leadId: string; outboxId: string } | { ok: false; reason: "consent_required" | "invalid_contact" | "unknown_draft" } {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  if (!input.consentToRespond) return { ok: false, reason: "consent_required" };
  if (name.length < 2 || name.length > 80 || !/^[^@\s]+@[^@\s]+$/.test(email) || email.length > 120) {
    return { ok: false, reason: "invalid_contact" };
  }
  if (!readNetProceedsDraft(db, input.draftId)) return { ok: false, reason: "unknown_draft" };

  const leadId = randomUUID();
  const outboxId = randomUUID();
  const occurredAt = now.toISOString();
  const body = JSON.stringify({
    event_id: outboxId,
    event_type: LEAD_EVENT_TYPE,
    schema_version: LEAD_SCHEMA_VERSION,
    occurred_at: occurredAt,
    producer: "maisonsquebec.ca",
    payload: {
      lead_id: leadId,
      lead_type: "vendeur",
      funnel_name: FUNNEL_NAME,
      contact_name: name,
      contact_email: email,
      consent_to_respond: true,
      consent_marketing: input.consentMarketing,
      consent_text_version: CONSENT_TEXT_VERSION,
    },
  });

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO leads (
         id, created_at, contact_name, contact_email, consent_to_respond, consent_marketing,
         consent_text_version, funnel_name, draft_id, delivery_status
       ) VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, 'pending')`,
    ).run(leadId, occurredAt, name, email, input.consentMarketing ? 1 : 0, CONSENT_TEXT_VERSION, FUNNEL_NAME, input.draftId);
    db.prepare(
      `INSERT INTO lead_outbox (id, lead_id, event_type, schema_version, body, status, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
    ).run(outboxId, leadId, LEAD_EVENT_TYPE, LEAD_SCHEMA_VERSION, body, occurredAt);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return { ok: true, leadId, outboxId };
}

export type LeadAggregate = {
  readonly id: string;
  readonly createdAt: string;
  readonly deliveryStatus: "pending" | "delivered";
  readonly consentToRespond: boolean;
  readonly consentMarketing: boolean;
};

export type LeadRecord = LeadAggregate & {
  readonly name: string;
  readonly email: string;
};

export function listLeadAggregates(db: DatabaseSync): LeadAggregate[] {
  return db
    .prepare(
      `SELECT id, created_at, delivery_status, consent_to_respond, consent_marketing
       FROM leads ORDER BY created_at DESC`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      deliveryStatus: row.delivery_status === "delivered" ? "delivered" : "pending",
      consentToRespond: Number(row.consent_to_respond) === 1,
      consentMarketing: Number(row.consent_marketing) === 1,
    }));
}

export function listLeadsForOwner(db: DatabaseSync): LeadRecord[] {
  return db
    .prepare(
      `SELECT id, created_at, delivery_status, consent_to_respond, consent_marketing, contact_name, contact_email
       FROM leads ORDER BY created_at DESC`,
    )
    .all()
    .map((row) => ({
      id: String(row.id),
      createdAt: String(row.created_at),
      deliveryStatus: row.delivery_status === "delivered" ? "delivered" : "pending",
      consentToRespond: Number(row.consent_to_respond) === 1,
      consentMarketing: Number(row.consent_marketing) === 1,
      name: String(row.contact_name),
      email: String(row.contact_email),
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
