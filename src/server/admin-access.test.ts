import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_REFUSAL_COPY,
  authorizeAdminRequest,
  issueAdminSessionCookie,
  renderAdminRefusalDocument,
  serializeAdminCookie,
} from "./admin-access";

const secret = "test-secret-not-a-real-credential";
const now = new Date("2026-10-31T20:00:00.000Z");

async function cookie(expiresAt: Date, role: "owner" | "editor" = "editor") {
  return issueAdminSessionCookie({
    secret,
    subject: "fondateur",
    role,
    expiresAt,
  });
}

describe("authorizeAdminRequest", () => {
  it("refuse tout quand le secret est vide, même avec un jeton", async () => {
    const value = await cookie(new Date(now.getTime() + 60_000));
    const decision = await authorizeAdminRequest({ secret: "  ", cookieValue: value, now });
    assert.deepEqual(decision, { allowed: false, httpStatus: 401, reason: "auth_not_configured" });
    const missingSecret = await authorizeAdminRequest({ secret: undefined, cookieValue: undefined, now });
    assert.equal(missingSecret.allowed, false);
  });

  it("refuse l'absence de session quand le secret est configuré", async () => {
    const decision = await authorizeAdminRequest({ secret, cookieValue: undefined, now });
    assert.equal(decision.allowed, false);
    if (decision.allowed) return;
    assert.equal(decision.reason, "missing_session");
    assert.equal(decision.httpStatus, 401);
  });

  it("accepte une session signée et laisse les trous visibles", async () => {
    const value = await cookie(new Date(now.getTime() + 60 * 60 * 1000));
    const decision = await authorizeAdminRequest({ secret, cookieValue: value, now });
    assert.equal(decision.allowed, true);
    if (!decision.allowed) return;
    assert.equal(decision.session.subject, "fondateur");
    assert.equal(decision.session.role, "editor");
    assert.equal(decision.session.mfaSatisfied, false);
    assert.deepEqual(decision.gaps, ["mfa_not_enforced"]);
  });

  it("vérifie la signature avec un HMAC indépendant", async () => {
    const issued = await cookie(new Date(now.getTime() + 60_000), "owner");
    const [payload, signature] = issued.split(".");
    assert.ok(payload && signature);
    const expected = createHmac("sha256", secret).update(payload).digest("base64url");
    assert.equal(signature, expected);
    const tampered = `${payload}.${expected.slice(0, -1)}${expected.endsWith("a") ? "b" : "a"}`;
    const decision = await authorizeAdminRequest({ secret, cookieValue: tampered, now });
    assert.equal(decision.allowed, false);
    if (decision.allowed) return;
    assert.equal(decision.reason, "invalid_session");
  });

  it("refuse un secret différent, une session expirée et une durée trop longue", async () => {
    const value = await cookie(new Date(now.getTime() + 60_000));
    const wrong = await authorizeAdminRequest({ secret: "autre-secret", cookieValue: value, now });
    assert.equal(wrong.allowed, false);

    const expired = await cookie(new Date(now.getTime() - 1));
    const expiredDecision = await authorizeAdminRequest({ secret, cookieValue: expired, now });
    assert.equal(expiredDecision.allowed, false);
    if (expiredDecision.allowed) return;
    assert.equal(expiredDecision.reason, "expired_session");

    const tooLong = await cookie(new Date(now.getTime() + 13 * 60 * 60 * 1000));
    const longDecision = await authorizeAdminRequest({ secret, cookieValue: tooLong, now });
    assert.equal(longDecision.allowed, false);
  });

  it("reconnaît un TOTP seulement s'il est dans le jeton signé", async () => {
    const value = await issueAdminSessionCookie({
      secret,
      subject: "fondateur",
      role: "owner",
      expiresAt: new Date(now.getTime() + 60_000),
      mfaSatisfied: true,
    });
    const decision = await authorizeAdminRequest({ secret, cookieValue: value, now });
    assert.equal(decision.allowed, true);
    if (!decision.allowed) return;
    assert.equal(decision.session.mfaSatisfied, true);
    assert.equal(decision.gaps.includes("mfa_not_enforced"), false);
  });

  it("refuse un champ inconnu ajouté au jeton", async () => {
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        sub: "fondateur",
        role: "owner",
        exp: now.getTime() + 60_000,
        mfa: true,
        elevated: true,
      }),
    ).toString("base64url");
    const signature = createHmac("sha256", secret).update(payload).digest("base64url");
    const decision = await authorizeAdminRequest({
      secret,
      cookieValue: `${payload}.${signature}`,
      now,
    });
    assert.equal(decision.allowed, false);
    if (decision.allowed) return;
    assert.equal(decision.reason, "invalid_session");
  });

  it("n'émet pas de session sans secret", async () => {
    await assert.rejects(() =>
      issueAdminSessionCookie({
        secret: " ",
        subject: "fondateur",
        role: "owner",
        expiresAt: new Date(now.getTime() + 1000),
      }),
    );
  });
});

describe("document de refus", () => {
  it("explique le trou MFA sans dire comment forger une session", () => {
    const html = renderAdminRefusalDocument();
    assert.match(html, new RegExp(ADMIN_REFUSAL_COPY.title));
    assert.match(html, /noindex/);
    assert.match(html, /lang="fr-CA"/);
    assert.match(html, /href="\/admin\/login"/);
    assert.equal(html.includes(ADMIN_COOKIE_NAME), false);
    assert.equal(html.includes("ADMIN_SESSION_SECRET"), false);
    assert.equal(html.toLowerCase().includes("cookie"), false);
    assert.equal(html.toLowerCase().includes("connecté"), false);
  });
});

describe("cookie admin", () => {
  it("pose HttpOnly et n'ajoute Secure que si demandé", () => {
    const local = serializeAdminCookie("jeton", { maxAgeSeconds: 60, secure: false });
    assert.match(local, /^mq_admin_session=jeton;/);
    assert.match(local, /HttpOnly/);
    assert.match(local, /SameSite=Lax/);
    assert.equal(local.includes("Secure"), false);
    const hosted = serializeAdminCookie("jeton", { maxAgeSeconds: 60, secure: true });
    assert.match(hosted, /Secure/);
  });
});
