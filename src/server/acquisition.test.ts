import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { auditPlainText } from "./admin-audit";
import { ADMIN_ROLES } from "./admin-access";
import {
  attemptsPlainText,
  captureLead,
  deliveryLabel,
  dispatchPendingOutbox,
  leadVisibility,
  listLeadAggregates,
  listWebhookDestinations,
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
