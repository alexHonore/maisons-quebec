import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  captureLead,
  dispatchPendingOutbox,
  listLeadAggregates,
  postWebhookRequest,
  saveNetProceedsDraft,
  signWebhook,
  validateWebhookUrl,
} from "./acquisition";
import { encryptTotpSecret, totpKeyFromSessionSecret } from "./totp-vault";
import { migrateUp } from "./settings-db";

const now = new Date("2026-10-31T22:40:00.000Z");
const sessionSecret = "secret-de-session-de-test";
const webhookSecret = "secret-de-destination-test";
const proceeds = {
  salePriceCents: 50_000_000,
  mortgageBalanceCents: 20_000_000,
  brokerage: { kind: "fixed" as const, amountCents: 1_000_000 },
  taxesOnBrokerage: [],
  mortgagePenaltyCents: null,
  legalFeesCents: 0,
  otherExpensesCents: 0,
};

type Received = { method: string; signature: string; timestamp: string; body: string };

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

function storeDestination(db: DatabaseSync, url: string) {
  const key = totpKeyFromSessionSecret(sessionSecret);
  if (!key) throw new Error("clé de session absente");
  db.prepare(
    `INSERT INTO webhook_destinations (id, name, url, secret_ciphertext, enabled, created_at)
     VALUES (?, ?, ?, ?, 1, ?)`,
  ).run(
    randomUUID(),
    "Récepteur local",
    url,
    encryptTotpSecret(new TextEncoder().encode(webhookSecret), key),
    now.toISOString(),
  );
}

function capture(db: DatabaseSync, email: string) {
  const draftId = saveNetProceedsDraft(db, proceeds, now);
  const saved = captureLead(db, {
    name: "Personne Test",
    email,
    consentToRespond: true,
    consentMarketing: false,
    draftId,
  }, now);
  assert.equal(saved.ok, true);
}

function listen(statusCode: number): Promise<{ url: string; received: Received[]; close: () => Promise<void> }> {
  const received: Received[] = [];
  const server = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received.push({
        method: request.method ?? "",
        signature: String(request.headers["x-maisons-signature"] ?? ""),
        timestamp: String(request.headers["x-maisons-timestamp"] ?? ""),
        body: Buffer.concat(chunks).toString("utf8"),
      });
      response.writeHead(statusCode);
      response.end();
    });
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string" || address.address !== "127.0.0.1") {
        throw new Error("Le serveur n'écoute pas sur 127.0.0.1.");
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/hook`,
        received,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe("livraison webhook locale", () => {
  it("poste un corps signé et ne marque livré qu'après un 2xx", async () => {
    assert.equal(validateWebhookUrl("http://127.0.0.1:9/hook"), null);
    const db = freshDb();
    const endpoint = await listen(204);
    try {
      storeDestination(db, endpoint.url);
      capture(db, "personne.locale@example.com");
      const result = await dispatchPendingOutbox(db, { now, sessionSecret, transport: postWebhookRequest });
      assert.equal(result.delivered, 1);
      assert.equal(endpoint.received.length, 1);
      const posted = endpoint.received[0];
      assert.equal(posted?.method, "POST");
      assert.equal(posted?.signature, signWebhook(webhookSecret, posted?.timestamp ?? "", posted?.body ?? ""));
      assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "delivered");
      assert.equal(db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get()?.status, "delivered");
    } finally {
      await endpoint.close();
      db.close();
    }
  });

  it("garde le lead et n'écrit pas livré si la réponse n'est pas 2xx", async () => {
    const db = freshDb();
    const endpoint = await listen(500);
    try {
      storeDestination(db, endpoint.url);
      capture(db, "personne.echec@example.com");
      const result = await dispatchPendingOutbox(db, { now, sessionSecret, transport: postWebhookRequest });
      assert.equal(result.delivered, 0);
      assert.equal(result.failed, 1);
      assert.equal(endpoint.received.length, 1);
      assert.equal(listLeadAggregates(db).length, 1);
      assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
      assert.equal(db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get()?.status, "pending");
      assert.equal(db.prepare("SELECT http_status, outcome FROM webhook_attempts").get()?.http_status, 500);
    } finally {
      await endpoint.close();
      db.close();
    }
  });

  it("garde le lead si le serveur local ne répond pas", async () => {
    const db = freshDb();
    const endpoint = await listen(204);
    const url = endpoint.url;
    await endpoint.close();
    try {
      storeDestination(db, url);
      capture(db, "personne.reseau@example.com");
      const result = await dispatchPendingOutbox(db, { now, sessionSecret, transport: postWebhookRequest });
      assert.equal(result.delivered, 0);
      assert.equal(result.failed, 1);
      assert.equal(listLeadAggregates(db).length, 1);
      assert.equal(listLeadAggregates(db)[0]?.deliveryStatus, "pending");
      assert.equal(db.prepare("SELECT status FROM lead_outbox WHERE event_type = 'lead.created'").get()?.status, "pending");
      assert.equal(db.prepare("SELECT error_code FROM webhook_attempts").get()?.error_code, "reseau");
    } finally {
      db.close();
    }
  });
});
