import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { auditPlainText } from "./admin-audit";
import { ADMIN_ROLES } from "./admin-access";
import { DEDUP_KEY } from "../domain/honest-funnels";
import { REGULATORY_EMPTY_LABEL } from "../domain/regulatory-identity";
import {
  APPOINTMENT_CONFIRMED,
  APPOINTMENT_REQUESTED,
  attemptsPlainText,
  captureLead,
  confirmAppointment,
  deliveryLabel,
  dispatchPendingOutbox,
  leadVisibility,
  listLeadAggregates,
  listLeadsForOwner,
  listWebhookDestinations,
  saveFunnelDraft,
  saveNetProceedsDraft,
  saveWebhookDestination,
  signWebhook,
} from "./acquisition";
import { migrateUp } from "./settings-db";

const now = new Date("2026-10-31T22:30:00.000Z");
const sessionSecret = "secret-de-session-de-test";

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

const input = {
  salePriceCents: 50_000_000,
  mortgageBalanceCents: 20_000_000,
  brokerage: { kind: "fixed" as const, amountCents: 1_000_000 },
  taxesOnBrokerage: [],
  mortgagePenaltyCents: null,
  legalFeesCents: 0,
  otherExpensesCents: 0,
};

describe("acquisition", () => {
  it("enregistre le lead avant l'envoi et le garde si la livraison échoue", async () => {
    const db = freshDb();
    const draftId = saveNetProceedsDraft(db, input, now);
    assert.equal(captureLead(db, { name: "A", email: "a@example.com", consentToRespond: false, consentMarketing: false, draftId }, now).ok, false);
    const saved = captureLead(db, {
      name: "Personne Test",
      email: "personne@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
    }, now);
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
    assert.equal(deliveryLabel("pending"), "en attente");
    const waiting = await dispatchPendingOutbox(db, { now, transport: async () => ({ status: 200 }), sessionSecret });
    assert.equal(waiting.waiting, 1);
    assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");

    saveWebhookDestination(db, {
      actorId: "acteur-1",
      actorRole: "integration_manager",
      name: "Récepteur",
      url: "https://hooks.example.test/leads",
      secret: "secret-de-destination-test",
      sessionSecret,
      now,
    });
    const failed = await dispatchPendingOutbox(db, {
      now,
      sessionSecret,
      transport: async () => {
        throw new Error("personne@example.com hors service");
      },
    });
    assert.equal(failed.failed, 1);
    assert.equal(listLeadAggregates(db).length, 1);
    assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
    assert.equal(attemptsPlainText(db).includes("personne@example.com"), false);
    assert.equal(auditPlainText(db).includes("personne@example.com"), false);
    assert.equal(auditPlainText(db).includes("https://hooks.example.test/leads"), false);
    const views = listWebhookDestinations(db);
    assert.equal("secret" in views[0]!, false);
    assert.equal(JSON.stringify(views).includes("secret-de-destination-test"), false);

    const delivered = await dispatchPendingOutbox(db, { now, sessionSecret, transport: async () => ({ status: 204 }) });
    assert.equal(delivered.delivered, 1);
    assert.equal(deliveryLabel("delivered"), "livré");
    db.close();
  });

  it("signe le corps et limite la vue des leads", () => {
    const body = "{\"event_type\":\"lead.created\"}";
    const timestamp = "2026-10-31T22:30:00.000Z";
    const secret = "secret-de-destination-test";
    assert.equal(signWebhook(secret, timestamp, body), createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex"));
    assert.deepEqual(ADMIN_ROLES.map((role) => [role, leadVisibility(role)]), [
      ["owner", "full"],
      ["editor", "none"],
      ["analyst", "aggregate"],
      ["integration_manager", "none"],
      ["automation_manager", "none"],
    ]);
  });

  it("n'expose pas le courriel dans l'agrégat", () => {
    const db = freshDb();
    const draftId = saveNetProceedsDraft(db, input, now);
    captureLead(db, {
      name: "Personne Test",
      email: "personne@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
    }, now);
    const aggregate = listLeadAggregates(db)[0];
    assert.equal(aggregate && "email" in aggregate, false);
    assert.equal(JSON.stringify(aggregate).includes("personne@example.com"), false);
    db.close();
  });
});

const estimationAnswers = {
  municipality: "Sillery",
  property_type: "condo",
  year_band: "recente",
  surface_band: "moyenne",
  bedrooms: "deux",
  condition: "travaux_a_prevoir",
};

function estimationDraft(db: DatabaseSync): string {
  return saveFunnelDraft(db, { funnelName: "estimation_maison", answers: estimationAnswers }, now);
}

describe("dédoublonnage et rendez-vous", () => {
  it(`utilise la clé ${DEDUP_KEY} et ne fusionne pas deux personnes`, async () => {
    const db = freshDb();
    const draftId = estimationDraft(db);
    const first = captureLead(db, {
      name: "Alice Martin",
      email: " Alice@Example.com ",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: "fenetre-privee-ne-pas-aggreger",
    }, now);
    assert.equal(first.ok, true);
    if (!first.ok) return;
    assert.equal(first.duplicate, false);
    const second = captureLead(db, {
      name: "Bob Martin",
      email: "alice@example.com",
      consentToRespond: true,
      consentMarketing: true,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: "autre plage",
    }, now);
    assert.equal(second.ok && second.duplicate && second.leadId === first.leadId && second.outboxId === null, true);
    const owner = listLeadsForOwner(db);
    assert.equal(owner.length, 1);
    assert.equal(owner[0]?.name, "Alice Martin");
    assert.equal(owner[0]?.consentMarketing, false);
    assert.equal(owner[0]?.appointmentStatus, "requested");
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = 'lead.created'").get()?.total, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM appointments").get()?.total, 1);

    const otherFunnel = saveFunnelDraft(db, { funnelName: "cout_total_achat", answers: { focus: "les_deux" } }, now);
    const separate = captureLead(db, {
      name: "Alice Martin",
      email: "alice@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId: otherFunnel,
      funnelName: "cout_total_achat",
    }, now);
    assert.equal(separate.ok && separate.duplicate === false, true);

    const sameName = captureLead(db, {
      name: "Alice Martin",
      email: "autre-personne@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
    }, now);
    assert.equal(sameName.ok && sameName.duplicate === false, true);
    assert.equal(listLeadsForOwner(db).length, 3);
    const aggregate = JSON.stringify(listLeadAggregates(db));
    assert.equal(aggregate.includes("fenetre-privee-ne-pas-aggreger"), false);
    assert.equal(aggregate.includes("alice@example.com"), false);
    assert.equal(aggregate.includes("autre-personne@example.com"), false);

    const events = db.prepare("SELECT event_type, body FROM lead_outbox").all();
    assert.equal(events.some((row) => row.event_type === APPOINTMENT_CONFIRMED), false);
    const requested = events.find((row) => row.event_type === APPOINTMENT_REQUESTED);
    assert.ok(requested);
    assert.equal(String(requested?.body).includes("alice@example.com"), false);
    assert.equal(String(requested?.body).includes("contact_email"), false);

    saveWebhookDestination(db, {
      actorId: "acteur-1",
      actorRole: "integration_manager",
      name: "Récepteur",
      url: "https://hooks.example.test/leads",
      secret: "secret-de-destination-test",
      sessionSecret,
      now,
    });
    const thrown = await dispatchPendingOutbox(db, {
      now,
      sessionSecret,
      transport: async () => {
        throw new Error("alice@example.com hors service");
      },
    });
    assert.equal(thrown.delivered, 0);
    assert.equal(thrown.failed > 0, true);
    assert.equal(listLeadsForOwner(db).length, 3);
    assert.equal(listLeadAggregates(db).every((row) => row.deliveryStatus === "pending"), true);
    assert.equal(attemptsPlainText(db).includes("alice@example.com"), false);
    db.close();
  });

  it("confirme un créneau seulement si un propriétaire le saisit", () => {
    const db = freshDb();
    const draftId = estimationDraft(db);
    const saved = captureLead(db, {
      name: "Camille Roy",
      email: "camille@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: "mardi matin",
    }, now);
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(captureLead(db, {
      name: "Camille Roy",
      email: "camille@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: "",
    }, now).ok, true);
    const refused = captureLead(db, {
      name: "Denis Roy",
      email: "denis@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: "",
    }, now);
    assert.deepEqual(refused, { ok: false, reason: "appointment_window_required" });
    assert.equal(confirmAppointment(db, { actorId: "editeur", actorRole: "editor", leadId: saved.leadId, slot: "mardi matin", now }).ok, false);
    assert.equal(confirmAppointment(db, { actorId: "analyste", actorRole: "analyst", leadId: saved.leadId, slot: "mardi matin", now }).ok, false);
    assert.deepEqual(
      confirmAppointment(db, { actorId: "owner-1", actorRole: "owner", leadId: saved.leadId, slot: REGULATORY_EMPTY_LABEL, now }),
      { ok: false, reason: "invalid_slot" },
    );
    const produit = saveNetProceedsDraft(db, input, now);
    const withoutAppointment = captureLead(db, {
      name: "Eve Roy",
      email: "eve@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId: produit,
    }, now);
    assert.equal(withoutAppointment.ok, true);
    if (!withoutAppointment.ok) return;
    assert.deepEqual(
      confirmAppointment(db, { actorId: "owner-1", actorRole: "owner", leadId: withoutAppointment.leadId, slot: "mardi matin", now }),
      { ok: false, reason: "not_requested" },
    );
    const confirmed = confirmAppointment(db, {
      actorId: "owner-1",
      actorRole: "owner",
      leadId: saved.leadId,
      slot: "  mardi matin au bureau  ",
      now,
    });
    assert.equal(confirmed.ok, true);
    assert.deepEqual(
      confirmAppointment(db, { actorId: "owner-1", actorRole: "owner", leadId: saved.leadId, slot: "mercredi matin", now }),
      { ok: false, reason: "already_confirmed" },
    );
    const confirmedEvents = db.prepare("SELECT body FROM lead_outbox WHERE event_type = ?").all(APPOINTMENT_CONFIRMED);
    assert.equal(confirmedEvents.length, 1);
    assert.equal(String(confirmedEvents[0]?.body).includes("camille@example.com"), false);
    assert.equal(String(confirmedEvents[0]?.body).includes("mardi matin au bureau"), true);
    const full = listLeadsForOwner(db).find((row) => row.id === saved.leadId);
    assert.equal(full?.appointmentStatus, "confirmed");
    assert.equal(full?.confirmedSlot, "mardi matin au bureau");
    const aggregate = listLeadAggregates(db).find((row) => row.id === saved.leadId);
    assert.equal(aggregate?.appointmentStatus, "confirmed");
    assert.equal(JSON.stringify(aggregate).includes("mardi matin au bureau"), false);
    assert.equal(auditPlainText(db).includes("mardi matin au bureau"), false);
    assert.equal(auditPlainText(db).includes("camille@example.com"), false);
    assert.match(auditPlainText(db), /appointment.confirmed/);
    db.close();
  });
});
