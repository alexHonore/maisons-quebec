import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { auditPlainText } from "./admin-audit";
import {
  captureLead,
  confirmAppointment,
  listLeadAggregates,
  saveFunnelDraft,
  saveNetProceedsDraft,
  saveWebhookDestination,
} from "./acquisition";
import { listAutomationRuns, listAutomationVersions, saveAutomation, setAutomationEnabled } from "./automations";
import { listQueueJobs } from "./job-queue";
import { migrateUp } from "./settings-db";

const now = new Date("2026-10-31T23:10:00.000Z");
const sessionSecret = "secret-de-session-de-test";
const email = "personne@example.com";

const proceeds = {
  salePriceCents: 50_000_000,
  mortgageBalanceCents: 20_000_000,
  brokerage: { kind: "fixed" as const, amountCents: 1_000_000 },
  taxesOnBrokerage: [],
  mortgagePenaltyCents: null,
  legalFeesCents: 0,
  otherExpensesCents: 0,
};

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

function capture(db: DatabaseSync, window?: string) {
  if (window) {
    const draftId = saveFunnelDraft(db, {
      funnelName: "estimation_maison",
      answers: {
        municipality: "Sillery",
        property_type: "condo",
        year_band: "recente",
        surface_band: "moyenne",
        bedrooms: "deux",
        condition: "travaux_a_prevoir",
      },
    }, now);
    return captureLead(db, {
      name: "Personne Test",
      email,
      consentToRespond: true,
      consentMarketing: false,
      draftId,
      funnelName: "estimation_maison",
      requestAppointment: true,
      appointmentWindow: window,
    }, now);
  }
  const draftId = saveNetProceedsDraft(db, proceeds, now);
  return captureLead(db, {
    name: "Personne Test",
    email,
    consentToRespond: true,
    consentMarketing: false,
    draftId,
  }, now);
}

describe("automatisations", () => {
  it("versionne la définition et réserve l'édition au propriétaire et au gestionnaire d'automatisation", () => {
    const db = freshDb();
    assert.equal(saveAutomation(db, {
      actorId: "editeur",
      actorRole: "editor",
      name: "relance_file",
      trigger: "lead.created",
      action: "admin.task",
      now,
    }).ok, false);
    assert.equal(saveAutomation(db, {
      actorId: "analyste",
      actorRole: "analyst",
      name: "relance_file",
      trigger: "page_view",
      action: "content.publish",
      now,
    }).ok, false);
    const first = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "relance_file",
      trigger: "lead.created",
      action: "admin.task",
      now,
    });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    const second = saveAutomation(db, {
      actorId: "auto-1",
      actorRole: "automation_manager",
      name: "relance_file",
      trigger: "appointment.requested",
      action: "webhook.requeue",
      now,
    });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.equal(second.id, first.id);
    assert.equal(second.versionNumber, 2);
    const versions = listAutomationVersions(db);
    assert.equal(versions.length, 2);
    assert.equal(versions[0]?.trigger, "lead.created");
    assert.equal(versions[1]?.action, "webhook.requeue");
    assert.equal(auditPlainText(db).includes(email), false);
    db.close();
  });

  it("écrit une tâche admin sans donnée personnelle quand le lead est créé", () => {
    const db = freshDb();
    const saved = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "note_lead",
      trigger: "lead.created",
      action: "admin.task",
      now,
    });
    assert.equal(saved.ok, true);
    const captured = capture(db);
    assert.equal(captured.ok, true);
    const runs = listAutomationRuns(db);
    assert.equal(runs.length, 1);
    assert.equal(runs[0]?.state, "tache_en_file");
    const jobs = listQueueJobs(db);
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.jobName, "automation.tache_admin");
    assert.equal(jobs[0]?.status, "queued");
    const stored = `${JSON.stringify(jobs)}\n${JSON.stringify(runs)}\n${auditPlainText(db)}`;
    assert.equal(stored.includes(email), false);
    assert.equal(stored.includes("livré"), false);
    assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
    db.close();
  });

  it("reste honnête quand aucune destination webhook n'existe", () => {
    const db = freshDb();
    saveAutomation(db, {
      actorId: "auto-1",
      actorRole: "automation_manager",
      name: "relance_file",
      trigger: "lead.created",
      action: "webhook.requeue",
      now,
    });
    const captured = capture(db);
    assert.equal(captured.ok, true);
    const runs = listAutomationRuns(db);
    assert.equal(runs[0]?.state, "aucune_destination");
    assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
    const outbox = db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get();
    assert.equal(String(outbox?.status), "pending");
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM webhook_attempts").get()?.total, 0);
    assert.equal(JSON.stringify(runs).includes("delivered"), false);
    assert.equal(JSON.stringify(runs).includes("livré"), false);
    db.close();
  });

  it("remet l'événement en file quand une destination existe, sans le déclarer livré", () => {
    const db = freshDb();
    saveWebhookDestination(db, {
      actorId: "integ-1",
      actorRole: "integration_manager",
      name: "Récepteur",
      url: "https://hooks.example.test/leads",
      secret: "secret-de-destination-test",
      sessionSecret,
      now,
    });
    saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "relance_file",
      trigger: "lead.created",
      action: "webhook.requeue",
      now,
    });
    assert.equal(capture(db).ok, true);
    assert.equal(listAutomationRuns(db)[0]?.state, "en_file");
    assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
    const outbox = db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get();
    assert.equal(String(outbox?.status), "pending");
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM webhook_attempts").get()?.total, 0);
    db.close();
  });

  it("s'exécute sur le rendez-vous demandé et confirmé, et ignore une définition inactive", () => {
    const db = freshDb();
    const requested = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "note_demande",
      trigger: "appointment.requested",
      action: "admin.task",
      now,
    });
    const confirmed = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "note_creneau",
      trigger: "appointment.confirmed",
      action: "admin.task",
      now,
    });
    assert.equal(requested.ok && confirmed.ok, true);
    if (!requested.ok || !confirmed.ok) return;
    setAutomationEnabled(db, { actorId: "owner-1", actorRole: "owner", id: confirmed.id, enabled: false, now });
    const captured = capture(db, "mardi matin");
    assert.equal(captured.ok, true);
    if (!captured.ok) return;
    assert.equal(listAutomationRuns(db).length, 1);
    assert.equal(listAutomationRuns(db)[0]?.trigger, "appointment.requested");
    setAutomationEnabled(db, { actorId: "auto-1", actorRole: "automation_manager", id: confirmed.id, enabled: true, now });
    const slot = confirmAppointment(db, {
      actorId: "owner-1",
      actorRole: "owner",
      leadId: captured.leadId,
      slot: "mardi matin au bureau",
      now,
    });
    assert.equal(slot.ok, true);
    const triggers = listAutomationRuns(db).map((run) => run.trigger).sort();
    assert.deepEqual(triggers, ["appointment.confirmed", "appointment.requested"]);
    assert.equal(JSON.stringify(listQueueJobs(db)).includes(email), false);
    assert.equal(JSON.stringify(listAutomationRuns(db)).includes("mardi matin"), false);
    db.close();
  });
});
