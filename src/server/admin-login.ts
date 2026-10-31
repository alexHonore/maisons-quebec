import { DatabaseSync } from "node:sqlite";
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import {
  createOwnerFromBootstrap,
  findAdminByEmail,
  passwordMatchesHash,
} from "./admin-accounts";
import {
  MAX_ADMIN_SESSION_MS,
  issueAdminSessionCookie,
  serializeAdminCookie,
  type AdminRole,
} from "./admin-access";
import { decodeBase32, verifyTotp } from "./totp";

export type LoginFailure = "auth_not_configured" | "invalid_credentials" | "invalid_totp";

export type LoginResult =
  | { readonly ok: false; readonly status: 401; readonly reason: LoginFailure; readonly body: string }
  | {
      readonly ok: true;
      readonly status: 303;
      readonly cookie: string;
      readonly mfaSatisfied: boolean;
      readonly body: string;
    };

function sameText(left: string, right: string): boolean {
  const a = createHash("sha256").update(left).digest();
  const b = createHash("sha256").update(right).digest();
  return timingSafeEqual(a, b);
}

function samePassword(input: string, expected: string): boolean {
  const salt = "maisons-quebec-bootstrap-v1";
  const a = scryptSync(input, salt, 32);
  const b = scryptSync(expected, salt, 32);
  return timingSafeEqual(a, b);
}

export function renderLoginDocument(input: { failed: boolean; email: string; notice: string }): string {
  const email = input.email
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
  const message = input.failed ? `<p role="alert">${input.notice}</p>` : "";
  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Connexion — Maisons Québec</title>
  <style>
    body { margin: 0; background: #f3efe6; color: #1b2421; font-family: "Segoe UI", sans-serif; }
    main { max-width: 28rem; margin: 0 auto; padding: 3rem 1.25rem; }
    h1 { font-family: Georgia, serif; font-size: 2rem; line-height: 1.15; }
    label { display: grid; gap: 0.35rem; font-weight: 650; margin: 0 0 0.9rem; }
    input { font: inherit; padding: 0.6rem 0.7rem; border: 1px solid #d9d0c0; border-radius: 0.6rem; }
    button { font: inherit; font-weight: 700; background: #16342c; color: #f6f1e7; border: 0; border-radius: 999px; padding: 0.7rem 1.1rem; }
    a { color: #0f4c3a; }
    p { line-height: 1.5; }
  </style>
</head>
<body>
  <main>
    <h1>Connexion à l'administration</h1>
    <p>Le premier propriétaire est créé seulement par le compte d'amorçage, à la première connexion valide. Les autres comptes sont enregistrés dans la base locale.</p>
    <p>Si le secret TOTP est vide, le second facteur n'est pas actif. La page ne dira pas qu'une session existe tant que le serveur n'en a pas créé une.</p>
    ${message}
    <form method="post" action="/admin/login">
      <label>Courriel <input name="email" type="email" autocomplete="username" required value="${email}"></label>
      <label>Mot de passe <input name="password" type="password" autocomplete="current-password" required></label>
      <label>Code TOTP <input name="totp" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"></label>
      <button type="submit">Entrer</button>
    </form>
    <p><a href="/">Retour à l'accueil</a></p>
  </main>
</body>
</html>`;
}

function refused(email: string, reason: LoginFailure, notice: string): LoginResult {
  return {
    ok: false,
    status: 401,
    reason,
    body: renderLoginDocument({ failed: true, email, notice }),
  };
}

function checkTotp(env: { readonly [key: string]: string | undefined }, code: string, now: Date): { ok: true; mfaSatisfied: boolean } | { ok: false } {
  const totpSecret = env.ADMIN_TOTP_SECRET?.trim() ?? "";
  if (totpSecret === "") return { ok: true, mfaSatisfied: false };
  const decoded = decodeBase32(totpSecret);
  if (!decoded || !verifyTotp(decoded, code.trim(), now.getTime())) return { ok: false };
  return { ok: true, mfaSatisfied: true };
}

async function issueLogin(input: {
  secret: string;
  userId: string;
  role: AdminRole;
  mfaSatisfied: boolean;
  now: Date;
  secure: boolean;
}): Promise<LoginResult> {
  const value = await issueAdminSessionCookie({
    secret: input.secret,
    subject: input.userId,
    role: input.role,
    expiresAt: new Date(input.now.getTime() + MAX_ADMIN_SESSION_MS),
    mfaSatisfied: input.mfaSatisfied,
  });
  return {
    ok: true,
    status: 303,
    mfaSatisfied: input.mfaSatisfied,
    cookie: serializeAdminCookie(value, {
      maxAgeSeconds: Math.floor(MAX_ADMIN_SESSION_MS / 1000),
      secure: input.secure,
    }),
    body: "",
  };
}

export async function attemptLogin(input: {
  email: string;
  password: string;
  totpCode: string;
  now: Date;
  secure: boolean;
  env: { readonly [key: string]: string | undefined };
  db: DatabaseSync;
}): Promise<LoginResult> {
  const sessionSecret = input.env.ADMIN_SESSION_SECRET?.trim() ?? "";
  const email = input.email.trim().toLowerCase();
  if (sessionSecret === "") {
    return refused(email, "auth_not_configured", "La connexion n'est pas configurée. Le secret de session est vide.");
  }

  const existing = findAdminByEmail(input.db, email);
  if (existing) {
    const passwordMatches = passwordMatchesHash(input.password, existing.passwordSalt, existing.passwordHash);
    if (!passwordMatches || existing.disabled) return refused(email, "invalid_credentials", "Identifiants refusés.");
    const totp = checkTotp(input.env, input.totpCode, input.now);
    if (!totp.ok) return refused(email, "invalid_totp", "Identifiants refusés.");
    return issueLogin({
      secret: sessionSecret,
      userId: existing.id,
      role: existing.role,
      mfaSatisfied: totp.mfaSatisfied,
      now: input.now,
      secure: input.secure,
    });
  }

  const expectedEmail = input.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase() ?? "";
  const expectedPassword = input.env.ADMIN_BOOTSTRAP_PASSWORD ?? "";
  if (expectedEmail === "" || expectedPassword === "") {
    return refused(
      email,
      "auth_not_configured",
      "La connexion n'est pas configurée. Le compte d'amorçage ou le secret de session est vide.",
    );
  }
  const emailMatches = sameText(email, expectedEmail);
  const passwordMatches = samePassword(input.password, expectedPassword);
  if (!emailMatches || !passwordMatches) return refused(email, "invalid_credentials", "Identifiants refusés.");
  const totp = checkTotp(input.env, input.totpCode, input.now);
  if (!totp.ok) return refused(email, "invalid_totp", "Identifiants refusés.");

  const created = createOwnerFromBootstrap(input.db, {
    email: expectedEmail,
    password: expectedPassword,
    now: input.now,
  });
  if (!created.ok) return refused(email, "invalid_credentials", "Identifiants refusés.");
  return issueLogin({
    secret: sessionSecret,
    userId: created.account.id,
    role: "owner",
    mfaSatisfied: totp.mfaSatisfied,
    now: input.now,
    secure: input.secure,
  });
}
