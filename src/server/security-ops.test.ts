import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { auditPlainText } from "./admin-audit";
import { createOwnerFromBootstrap } from "./admin-accounts";
import { attemptLogin } from "./admin-login";
import { JobError, enqueueJob, executeNextJob, listQueueJobs, retryFailedJob } from "./job-queue";
import { listJobRuns } from "./job-journal";
import { migrateUp } from "./settings-db";
import { saveSettings } from "./settings-db";
import { recordAdminAudit } from "./admin-audit";
import { generateTotp } from "./totp";
import {
  beginTotpEnrollment,
  confirmTotpEnrollment,
  renderTotpEnrollment,
  renderTotpStatus,
  storedTotpCiphertext,
  totpKeyFromSessionSecret,
} from "./totp-vault";

const now = new Date("2026-10-31T22:00:00.000Z");
const sessionSecret = "secret-de-session-de-test";
const accountSecret = new TextEncoder().encode("12345678901234567890");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

describe("TOTP par compte", () => {
  it("chiffre le secret, confirme avec un code de test, puis l'exige sans dire MFA actif avant", async () => {
    const db = freshDb();
    const owner = createOwnerFromBootstrap(db, {
      email: "owner@example.com",
      password: "phrase-de-test-seulement",
      now,
    });
    assert.equal(owner.ok, true);
    if (!owner.ok) return;
    const key = totpKeyFromSessionSecret(sessionSecret);
    assert.ok(key);
    const started = beginTotpEnrollment(db, {
      userId: owner.account.id,
      actorRole: "owner",
      key,
      now,
      secret: accountSecret,
    });
    assert.equal(started.ok, true);
    if (!started.ok) return;
    const statusBefore = renderTotpStatus({ state: "pending", sessionMfa: false, globalSecretConfigured: false });
    assert.equal(statusBefore.includes(started.secretBase32), false);
    assert.match(statusBefore, /MFA non actif/);
    assert.equal(statusBefore.includes("MFA actif"), false);
    assert.equal(storedTotpCiphertext(db, owner.account.id)?.includes(started.secretBase32), false);
    assert.match(renderTotpEnrollment(started.secretBase32), new RegExp(started.secretBase32));

    const code = generateTotp(accountSecret, now.getTime());
    assert.equal(
      confirmTotpEnrollment(db, { userId: owner.account.id, actorRole: "owner", key, code: "000000", now }).ok,
      false,
    );
    assert.equal(confirmTotpEnrollment(db, { userId: owner.account.id, actorRole: "owner", key, code, now }).ok, true);
    const confirmedText = renderTotpStatus({ state: "confirmed", sessionMfa: false, globalSecretConfigured: false });
    assert.equal(confirmedText.includes(started.secretBase32), false);
    assert.match(confirmedText, /MFA non actif/);

    const env = {
      ADMIN_BOOTSTRAP_EMAIL: "owner@example.com",
      ADMIN_BOOTSTRAP_PASSWORD: "phrase-de-test-seulement",
      ADMIN_SESSION_SECRET: sessionSecret,
      ADMIN_TOTP_SECRET: "",
    };
    const missing = await attemptLogin({
      email: "owner@example.com",
      password: "phrase-de-test-seulement",
      totpCode: "",
      now,
      secure: false,
      env,
      db,
    });
    assert.equal(missing.ok, false);
    if (missing.ok) return;
    assert.equal(missing.reason, "invalid_totp");
    const accepted = await attemptLogin({
      email: "owner@example.com",
      password: "phrase-de-test-seulement",
      totpCode: code,
      now,
      secure: false,
      env,
      db,
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.mfaSatisfied, true);
    const trail = auditPlainText(db);
    assert.equal(trail.includes("owner@example.com"), false);
    assert.equal(trail.includes(started.secretBase32), false);
    db.close();
  });

  it("laisse le trou explicite quand le secret global est vide et qu'aucun facteur n'est enregistré", () => {
    const text = renderTotpStatus({ state: "absent", sessionMfa: false, globalSecretConfigured: false });
    assert.match(text, /secret TOTP global est vide/);
    assert.match(text, /MFA non actif/);
    assert.equal(text.includes("MFA actif"), false);
  });

  it("refuse l'enrôlement à un rôle non privilégié", () => {
    const db = freshDb();
    const key = totpKeyFromSessionSecret(sessionSecret);
    assert.ok(key);
    const result = beginTotpEnrollment(db, {
      userId: "00000000-0000-4000-8000-000000000001",
      actorRole: "editor",
      key,
      now,
      secret: accountSecret,
    });
    assert.equal(result.ok, false);
    db.close();
  });
});

describe("file de jobs", () => {
  it("enfile, échoue sans recopier l'erreur brute, puis reprend", () => {
    const db = freshDb();
    saveSettings(db, { broker_oaciq_permit: "PERMIS-NE-DOIT-PAS-FUITER" });
    const queued = enqueueJob(db, { jobName: "essai.fragile", actorId: "acteur-1", actorRole: "owner", now, maxAttempts: 2 });
    let calls = 0;
    const failed = executeNextJob(db, {
      actorId: "acteur-1",
      now,
      handlers: {
        "essai.fragile": () => {
          calls += 1;
          throw new Error("PERMIS-NE-DOIT-PAS-FUITER owner@example.com");
        },
      },
    });
    assert.equal(failed.outcome, "failed");
    if (failed.outcome !== "failed") return;
    assert.equal(failed.errorCode, "erreur_interne");
    assert.equal(executeNextJob(db, { actorId: "acteur-1", now, handlers: {} }).outcome, "idle");
    assert.equal(retryFailedJob(db, { id: queued.id, actorId: "acteur-1", actorRole: "owner", now }).ok, true);
    const succeeded = executeNextJob(db, {
      actorId: "acteur-1",
      now,
      handlers: { "essai.fragile": () => { calls += 1; } },
    });
    assert.equal(succeeded.outcome, "succeeded");
    assert.equal(calls, 2);
    const stored = JSON.stringify(listQueueJobs(db));
    assert.equal(stored.includes("PERMIS-NE-DOIT-PAS-FUITER"), false);
    assert.equal(stored.includes("owner@example.com"), false);
    assert.equal(auditPlainText(db).includes("owner@example.com"), false);
    db.close();
  });

  it("exécute le contrôle honnête et refuse une reprise épuisée", () => {
    const db = freshDb();
    const queued = enqueueJob(db, {
      jobName: "reglages.controle_champs_vides",
      actorId: "acteur-1",
      actorRole: "automation_manager",
      now,
      maxAttempts: 1,
    });
    const done = executeNextJob(db, { actorId: "acteur-1", now });
    assert.equal(done.outcome, "succeeded");
    const journal = listJobRuns(db);
    assert.equal(journal.length, 1);
    assert.match(journal[0]?.summary ?? "", /Aucune statistique produite/);
    assert.equal(journal[0]?.summary.includes("@"), false);
    const again = enqueueJob(db, {
      jobName: "essai.fragile",
      actorId: "acteur-1",
      actorRole: "owner",
      now,
      maxAttempts: 1,
    });
    executeNextJob(db, {
      actorId: "acteur-1",
      now,
      handlers: { "essai.fragile": () => { throw new JobError("demo_failure"); } },
    });
    assert.equal(retryFailedJob(db, { id: again.id, actorId: "acteur-1", actorRole: "owner", now }).ok, false);
    assert.notEqual(queued.id, again.id);
    db.close();
  });
});

describe("audit", () => {
  it("note qui, quoi et quand sans permis ni secret", () => {
    const db = freshDb();
    const permit = "PERMIS-NE-DOIT-PAS-FUITER";
    saveSettings(db, { broker_oaciq_permit: permit });
    recordAdminAudit(db, {
      actorId: "11111111-1111-4111-8111-111111111111",
      actorRole: "owner",
      action: "settings.updated",
      subjectId: null,
      at: now,
    });
    const text = auditPlainText(db);
    assert.match(text, /settings.updated/);
    assert.match(text, /11111111-1111-4111-8111-111111111111/);
    assert.equal(text.includes(permit), false);
    assert.equal(text.includes("@"), false);
    db.close();
  });
});
