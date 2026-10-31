import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAutomation, requestN8nConnection } from "./automation";

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
});
