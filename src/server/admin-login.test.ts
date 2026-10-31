import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { countOwners, findAdminById } from "./admin-accounts";
import { authorizeAdminRequest } from "./admin-access";
import { attemptLogin, renderLoginDocument } from "./admin-login";
import { migrateUp } from "./settings-db";
import { generateTotp } from "./totp";

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

const now = new Date("2026-10-31T21:00:00.000Z");
const secretBytes = new TextEncoder().encode("12345678901234567890");

const baseEnv = {
  ADMIN_BOOTSTRAP_EMAIL: "essai@example.com",
  ADMIN_BOOTSTRAP_PASSWORD: "phrase-de-test-seulement",
  ADMIN_SESSION_SECRET: "secret-de-session-de-test",
  ADMIN_TOTP_SECRET: "",
};

describe("connexion admin", () => {
  it("refuse quand le compte d'amorçage est vide", async () => {
    const result = await attemptLogin({
      email: "essai@example.com",
      password: "phrase-de-test-seulement",
      totpCode: "",
      now,
      secure: false,
      db: freshDb(),
      env: { ...baseEnv, ADMIN_BOOTSTRAP_PASSWORD: "" },
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 401);
    assert.equal(result.reason, "auth_not_configured");
    assert.match(result.body, /n'est pas configurée/);
    assert.equal(result.body.toLowerCase().includes("connecté"), false);
  });

  it("refuse un mot de passe absent ou faux", async () => {
    const missing = await attemptLogin({
      email: "",
      password: "",
      totpCode: "",
      now,
      secure: false,
      db: freshDb(),
      env: baseEnv,
    });
    assert.equal(missing.status, 401);
    const wrongDb = freshDb();
    const wrong = await attemptLogin({
      email: "essai@example.com",
      password: "autre",
      totpCode: "",
      now,
      secure: false,
      db: wrongDb,
      env: baseEnv,
    });
    assert.equal(wrong.ok, false);
    if (wrong.ok) return;
    assert.equal(wrong.reason, "invalid_credentials");
    assert.match(wrong.body, /Identifiants refusés/);
    assert.equal(countOwners(wrongDb), 0);
    wrongDb.close();
  });

  it("ouvre une session HttpOnly sans prétendre au TOTP quand le secret est vide", async () => {
    const db = freshDb();
    const result = await attemptLogin({
      email: "Essai@example.com",
      password: "phrase-de-test-seulement",
      totpCode: "",
      now,
      secure: true,
      db,
      env: baseEnv,
    });
    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.status, 303);
    assert.equal(result.mfaSatisfied, false);
    assert.match(result.cookie, /HttpOnly/);
    assert.match(result.cookie, /Secure/);
    const value = result.cookie.split(";")[0]?.split("=").slice(1).join("=");
    const decision = await authorizeAdminRequest({
      secret: baseEnv.ADMIN_SESSION_SECRET,
      cookieValue: value,
      now,
    });
    assert.equal(decision.allowed, true);
    if (!decision.allowed) return;
    assert.equal(decision.session.mfaSatisfied, false);
    assert.equal(decision.session.role, "owner");
    assert.notEqual(decision.session.subject, "essai@example.com");
    assert.equal(findAdminById(db, decision.session.subject)?.role, "owner");
    assert.equal(countOwners(db), 1);
    const again = await attemptLogin({
      email: "essai@example.com",
      password: "phrase-de-test-seulement",
      totpCode: "",
      now,
      secure: false,
      db,
      env: { ...baseEnv, ADMIN_BOOTSTRAP_PASSWORD: "" },
    });
    assert.equal(again.ok, true);
    assert.equal(countOwners(db), 1);
    db.close();
  });

  it("exige un TOTP valide quand le secret de test est présent", async () => {
    const env = { ...baseEnv, ADMIN_TOTP_SECRET: "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ" };
    const db = freshDb();
    const refused = await attemptLogin({
      email: "essai@example.com",
      password: "phrase-de-test-seulement",
      totpCode: "000000",
      now,
      secure: false,
      db,
      env,
    });
    assert.equal(refused.ok, false);
    if (refused.ok) return;
    assert.equal(refused.reason, "invalid_totp");
    assert.equal(refused.body.toLowerCase().includes("connecté"), false);
    assert.equal(countOwners(db), 0);

    const code = generateTotp(secretBytes, now.getTime());
    const accepted = await attemptLogin({
      email: "essai@example.com",
      password: "phrase-de-test-seulement",
      totpCode: code,
      now,
      secure: false,
      db,
      env,
    });
    assert.equal(accepted.ok, true);
    if (!accepted.ok) return;
    assert.equal(accepted.mfaSatisfied, true);
    const value = accepted.cookie.split(";")[0]?.split("=").slice(1).join("=");
    const decision = await authorizeAdminRequest({
      secret: env.ADMIN_SESSION_SECRET,
      cookieValue: value,
      now,
    });
    assert.equal(decision.allowed, true);
    if (!decision.allowed) return;
    assert.equal(decision.session.mfaSatisfied, true);
    const outsider = await attemptLogin({
      email: "autre@example.com",
      password: "phrase-de-test-seulement",
      totpCode: code,
      now,
      secure: false,
      db,
      env,
    });
    assert.equal(outsider.ok, false);
    assert.equal(countOwners(db), 1);
    db.close();
  });
});

describe("formulaire de connexion", () => {
  it("n'annonce pas une session", () => {
    const html = renderLoginDocument({ failed: false, email: "", notice: "" });
    assert.equal(html.toLowerCase().includes("connecté"), false);
    assert.match(html, /method="post"/);
    assert.match(html, /name="password"/);
  });
});
