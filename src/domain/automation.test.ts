import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dryRunAutomation, parseAutomation, parseAutomationDocument, renderAutomationJson, requestN8nConnection } from "./automation";

describe("définitions d'automatisation", () => {
  it("n'accepte que les événements émis et les deux actions de cette tranche", () => {
    assert.equal(parseAutomation({ name: "relance_file", trigger: "lead.created", action: "webhook.requeue" }).ok, true);
    assert.equal(parseAutomation({ name: "note_admin", trigger: "appointment.requested", action: "admin.task" }).ok, true);
    assert.equal(parseAutomation({ name: "note_creneau", trigger: "appointment.confirmed", action: "admin.task" }).ok, true);
    assert.equal(parseAutomation({ name: "hors_sujet", trigger: "page_view", action: "admin.task" }).ok, false);
    assert.equal(parseAutomation({ name: "publication", trigger: "lead.created", action: "content.publish" }).ok, false);
    assert.equal(parseAutomation({ name: "javascript_alert", trigger: "lead.created", action: "admin.task" }).ok, false);
    assert.equal(parseAutomation({ name: "personne@example.com", trigger: "lead.created", action: "admin.task" }).ok, false);
  });

  it("n'appelle pas n8n quand l'adresse est vide, et ne réussit pas quand elle est présente", async () => {
    let called = 0;
    const transport = async () => {
      called += 1;
      return { status: 200 };
    };
    const empty = requestN8nConnection({ baseUrl: "  ", transport });
    assert.deepEqual(empty, { ok: false, message: "à connecter", called: false });
    const present = requestN8nConnection({ baseUrl: "https://n8n.example.test", transport });
    assert.deepEqual(present, { ok: false, message: "non branché", called: false });
    assert.equal(called, 0);
  });

  it("n'exporte que le nom, le déclencheur et l'action, et refuse le reste", () => {
    const parsed = parseAutomation({ name: "relance_file", trigger: "lead.created", action: "webhook.requeue" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const body = renderAutomationJson({
      schema_version: "1.0",
      name: parsed.definition.name,
      trigger: parsed.definition.trigger,
      action: parsed.definition.action,
    });
    assert.deepEqual(Object.keys(JSON.parse(body)), ["schema_version", "name", "trigger", "action"]);
    const same = parseAutomationDocument(body);
    assert.equal(same.ok, true);
    assert.deepEqual(parseAutomationDocument(JSON.stringify({
      schema_version: "1.0",
      name: "relance_file",
      trigger: "page_view",
      action: "admin.task",
    })), { ok: false, reason: "invalid_trigger" });
    assert.deepEqual(parseAutomationDocument(JSON.stringify({
      schema_version: "1.0",
      name: "relance_file",
      trigger: "lead.created",
      action: "content.publish",
    })), { ok: false, reason: "invalid_action" });
    assert.deepEqual(parseAutomationDocument(JSON.stringify({
      schema_version: "1.0",
      name: "relance_file",
      trigger: "lead.created",
      action: "webhook.requeue",
      nodes: [{ type: "javascript" }],
    })), { ok: false, reason: "invalid_document" });
    const secret = parseAutomationDocument(JSON.stringify({
      schema_version: "1.0",
      name: "relance_file",
      trigger: "lead.created",
      action: "webhook.requeue",
      secret: "secret-de-destination-test",
      url: "https://hooks.example.test/leads",
      email: "personne@example.com",
    }));
    assert.deepEqual(secret, { ok: false, reason: "secret_present" });
    const preview = dryRunAutomation(parsed.definition);
    assert.equal(preview.executed, false);
    assert.equal(preview.requeuedWebhook, false);
    assert.equal(preview.createdTask, false);
    assert.match(preview.summary, /Aucune livraison n'a été remise en file/);
    assert.match(preview.summary, /Aucune tâche n'a été créée/);
  });
});
