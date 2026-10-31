import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { auditPlainText } from "./admin-audit";
import {
  APPOINTMENT_CONFIRMED,
  captureLead,
  confirmAppointment,
  saveFunnelDraft,
  saveNetProceedsDraft,
} from "./acquisition";
import {
  enqueueCustomEvents,
  listEventDefinitions,
  listEventTraces,
  nativeEventCounts,
  saveEventDefinition,
  setEventDefinitionEnabled,
} from "./event-catalog";
import { migrateUp } from "./settings-db";

const now = new Date("2026-10-31T22:40:00.000Z");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

const estimationAnswers = {
  municipality: "Sillery",
  property_type: "condo",
  year_band: "recente",
  surface_band: "moyenne",
  bedrooms: "deux",
  condition: "travaux_a_prevoir",
};

describe("catalogue admin", () => {
  it("limite l'édition au propriétaire et au gestionnaire d'intégrations", () => {
    const db = freshDb();
    assert.equal(saveEventDefinition(db, {
      actorId: "editeur",
      actorRole: "editor",
      name: "signal_outil",
      trigger: "lead.created",
      schemaVersion: "1.0",
      now,
    }).ok, false);
    assert.equal(saveEventDefinition(db, {
      actorId: "analyste",
      actorRole: "analyst",
      name: "signal_outil",
      trigger: "lead.created",
      schemaVersion: "1.0",
      now,
    }).ok, false);
    assert.deepEqual(Object.keys(nativeEventCounts(db)), ["lead.created", "appointment.requested", "appointment.confirmed"]);
    const saved = saveEventDefinition(db, {
      actorId: "integrateur",
      actorRole: "integration_manager",
      name: "signal_outil",
      trigger: "lead.created",
      schemaVersion: "1.0",
      funnelName: "estimation_maison",
      now,
    });
    assert.equal(saved.ok, true);
    assert.equal(saveEventDefinition(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "signal_outil",
      trigger: "function(){return true}",
      schemaVersion: "1.0",
      now,
    }).ok, false);
    assert.deepEqual(saveEventDefinition(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "sans_consentement",
      trigger: "lead.created",
      schemaVersion: "1.0",
      consentRequired: false,
      now,
    }), { ok: false, reason: "consent_locked" });
    assert.equal(listEventDefinitions(db).length, 1);
    assert.equal(auditPlainText(db).includes("@"), false);
    db.close();
  });

  it("n'émet le signal personnalisé qu'avec le consentement, et le garde après désactivation", () => {
    const db = freshDb();
    const definition = saveEventDefinition(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "signal_outil",
      trigger: "lead.created",
      schemaVersion: "1.0",
      funnelName: "estimation_maison",
      now,
    });
    assert.equal(definition.ok, true);
    if (!definition.ok) return;
    const draftId = saveFunnelDraft(db, { funnelName: "estimation_maison", answers: estimationAnswers }, now);
    assert.equal(captureLead(db, {
      name: "Alice Martin",
      email: "alice@example.com",
      consentToRespond: false,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
    }, now).ok, false);
    assert.equal(nativeEventCounts(db)["lead.created"], 0);
    assert.equal(listEventDefinitions(db)[0]?.observedCount, 0);
    const saved = captureLead(db, {
      name: "Alice Martin",
      email: "alice@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
    }, now);
    assert.equal(saved.ok, true);
    const bodies = db.prepare("SELECT event_type, body FROM lead_outbox").all();
    assert.equal(bodies.filter((row) => row.event_type === "signal_outil").length, 1);
    assert.equal(String(bodies.find((row) => row.event_type === "signal_outil")?.body).includes("alice@example.com"), false);
    assert.equal(String(bodies.find((row) => row.event_type === "signal_outil")?.body).includes("consent_to_respond\":true"), true);
    const other = saveNetProceedsDraft(db, {
      salePriceCents: 50_000_000,
      mortgageBalanceCents: 0,
      brokerage: { kind: "fixed", amountCents: 0 },
      taxesOnBrokerage: [],
      mortgagePenaltyCents: null,
      legalFeesCents: 0,
      otherExpensesCents: 0,
    }, now);
    captureLead(db, {
      name: "Bob Martin",
      email: "bob@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId: other,
    }, now);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = 'signal_outil'").get()?.total, 1);
    assert.equal(setEventDefinitionEnabled(db, { actorId: "owner-1", actorRole: "owner", id: definition.id, enabled: false, now }).ok, true);
    captureLead(db, {
      name: "Carla Martin",
      email: "carla@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
    }, now);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = 'signal_outil'").get()?.total, 1);
    enqueueCustomEvents(db, {
      trigger: "lead.created",
      leadId: "lead-sans-consentement",
      funnelName: "estimation_maison",
      sourceEventId: "source",
      occurredAt: now.toISOString(),
      consentToRespond: false,
    });
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = 'signal_outil'").get()?.total, 1);
    const traces = JSON.stringify(listEventTraces(db));
    assert.equal(traces.includes("alice@example.com"), false);
    assert.equal(traces.includes("body"), false);
    db.close();
  });

  it("n'émet pas une confirmation personnalisée avant le créneau du propriétaire", () => {
    const db = freshDb();
    saveEventDefinition(db, {
      actorId: "integrateur",
      actorRole: "integration_manager",
      name: "creneau_signal",
      trigger: "appointment.confirmed",
      schemaVersion: "1.0",
      now,
    });
    const draftId = saveFunnelDraft(db, { funnelName: "estimation_maison", answers: estimationAnswers }, now);
    const saved = captureLead(db, {
      name: "Alice Martin",
      email: "alice@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: "jeudi matin",
    }, now);
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = 'creneau_signal'").get()?.total, 0);
    assert.equal(confirmAppointment(db, {
      actorId: "owner-1",
      actorRole: "owner",
      leadId: saved.leadId,
      slot: "jeudi matin au bureau",
      now,
    }).ok, true);
    const custom = db.prepare("SELECT body FROM lead_outbox WHERE event_type = 'creneau_signal'").all();
    assert.equal(custom.length, 1);
    assert.equal(String(custom[0]?.body).includes("alice@example.com"), false);
    assert.equal(String(custom[0]?.body).includes("jeudi matin au bureau"), false);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM lead_outbox WHERE event_type = ?").get(APPOINTMENT_CONFIRMED)?.total, 1);
    db.close();
  });
});
