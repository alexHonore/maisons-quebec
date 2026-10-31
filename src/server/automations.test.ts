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
import {
  exportAutomationJson,
  importAutomationJson,
  listAutomationRuns,
  listAutomationVersions,
  previewAutomation,
  saveAutomation,
  setAutomationEnabled,
} from "./automations";
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

  it("exporte un JSON sans secret et importe une nouvelle version sans effacer l'historique", () => {
    const db = freshDb();
    const secret = "secret-de-destination-test";
    const url = "https://hooks.example.test/leads";
    saveWebhookDestination(db, {
      actorId: "integ-1",
      actorRole: "integration_manager",
      name: "Récepteur",
      url,
      secret,
      sessionSecret,
      now,
    });
    assert.equal(capture(db).ok, true);
    const saved = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "relance_file",
      trigger: "lead.created",
      action: "webhook.requeue",
      now,
    });
    assert.equal(saved.ok, true);
    if (!saved.ok) return;
    assert.equal(exportAutomationJson(db, { actorRole: "editor", id: saved.id }).ok, false);
    assert.equal(exportAutomationJson(db, { actorRole: "integration_manager", id: saved.id }).ok, false);
    const exported = exportAutomationJson(db, { actorRole: "automation_manager", id: saved.id });
    assert.equal(exported.ok, true);
    if (!exported.ok) return;
    assert.deepEqual(Object.keys(JSON.parse(exported.body)), ["schema_version", "name", "trigger", "action"]);
    assert.equal(exported.body.includes(secret), false);
    assert.equal(exported.body.includes(url), false);
    assert.equal(exported.body.includes(email), false);
    assert.equal(exported.body.includes("https"), false);
    const imported = importAutomationJson(db, {
      actorId: "auto-1",
      actorRole: "automation_manager",
      body: exported.body,
      now,
    });
    assert.equal(imported.ok, true);
    if (!imported.ok) return;
    assert.equal(imported.versionNumber, 2);
    const changed = importAutomationJson(db, {
      actorId: "owner-1",
      actorRole: "owner",
      body: JSON.stringify({
        schema_version: "1.0",
        name: "relance_file",
        trigger: "appointment.requested",
        action: "admin.task",
      }),
      now,
    });
    assert.equal(changed.ok, true);
    const versions = listAutomationVersions(db);
    assert.equal(versions.length, 3);
    assert.equal(versions[0]?.trigger, "lead.created");
    assert.equal(versions[0]?.action, "webhook.requeue");
    assert.equal(versions[2]?.trigger, "appointment.requested");
    assert.equal(versions[2]?.action, "admin.task");
    db.close();
  });

  it("refuse un déclencheur, une action ou un secret, sans écrire de version", () => {
    const db = freshDb();
    const saved = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "relance_file",
      trigger: "lead.created",
      action: "admin.task",
      now,
    });
    assert.equal(saved.ok, true);
    const refused = [
      { schema_version: "1.0", name: "relance_file", trigger: "page_view", action: "admin.task" },
      { schema_version: "1.0", name: "relance_file", trigger: "lead.created", action: "content.publish" },
      { schema_version: "1.0", name: "relance_file", trigger: "lead.created", action: "webhook.requeue", secret: "secret-de-destination-test" },
      { schema_version: "1.0", name: "relance_file", trigger: "lead.created", action: "webhook.requeue", url: "https://hooks.example.test/leads" },
      { schema_version: "1.0", name: "relance_file", trigger: "lead.created", action: "admin.task", email: email },
    ];
    for (const document of refused) {
      const result = importAutomationJson(db, {
        actorId: "owner-1",
        actorRole: "owner",
        body: JSON.stringify(document),
        now,
      });
      assert.equal(result.ok, false);
    }
    assert.equal(importAutomationJson(db, {
      actorId: "editeur",
      actorRole: "editor",
      body: JSON.stringify({ schema_version: "1.0", name: "autre_note", trigger: "lead.created", action: "admin.task" }),
      now,
    }).ok, false);
    assert.equal(listAutomationVersions(db).length, 1);
    const stored = JSON.stringify(listAutomationVersions(db));
    assert.equal(stored.includes("secret-de-destination-test"), false);
    assert.equal(stored.includes("hooks.example.test"), false);
    assert.equal(stored.includes(email), false);
    db.close();
  });

  it("montre l'essai à blanc sans remettre de webhook en file ni créer de tâche", () => {
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
    assert.equal(capture(db).ok, true);
    const webhook = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "relance_file",
      trigger: "lead.created",
      action: "webhook.requeue",
      now,
    });
    const task = saveAutomation(db, {
      actorId: "owner-1",
      actorRole: "owner",
      name: "note_lead",
      trigger: "appointment.confirmed",
      action: "admin.task",
      now,
    });
    assert.equal(webhook.ok && task.ok, true);
    if (!webhook.ok || !task.ok) return;
    setAutomationEnabled(db, { actorId: "owner-1", actorRole: "owner", id: task.id, enabled: false, now });
    const jobsBefore = listQueueJobs(db).length;
    const runsBefore = listAutomationRuns(db).length;
    const attemptsBefore = Number(db.prepare("SELECT COUNT(*) AS total FROM webhook_attempts").get()?.total ?? 0);
    const outboxBefore = String(db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get()?.status);
    assert.equal(previewAutomation(db, { actorRole: "analyst", id: webhook.id }).ok, false);
    const webhookPreview = previewAutomation(db, { actorRole: "owner", id: webhook.id });
    const taskPreview = previewAutomation(db, { actorRole: "automation_manager", id: task.id });
    assert.equal(webhookPreview.ok && taskPreview.ok, true);
    if (!webhookPreview.ok || !taskPreview.ok) return;
    assert.equal(webhookPreview.requeuedWebhook, false);
    assert.equal(webhookPreview.createdTask, false);
    assert.equal(taskPreview.requeuedWebhook, false);
    assert.equal(taskPreview.createdTask, false);
    assert.match(taskPreview.summary, /Définition inactive/);
    assert.equal(listQueueJobs(db).length, jobsBefore);
    assert.equal(listAutomationRuns(db).length, runsBefore);
    assert.equal(Number(db.prepare("SELECT COUNT(*) AS total FROM webhook_attempts").get()?.total ?? 0), attemptsBefore);
    assert.equal(String(db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get()?.status), outboxBefore);
    assert.equal(db.prepare("SELECT enabled FROM automations WHERE id = ?").get(task.id)?.enabled, 0);
    db.close();
  });
});
