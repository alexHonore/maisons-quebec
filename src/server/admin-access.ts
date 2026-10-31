/**
 * Garde d'administration.
 * Sans `ADMIN_SESSION_SECRET`, aucune session n'est acceptée.
 * `mfa` n'est vrai dans le jeton que si l'émetteur l'a signé après un TOTP valide.
 * Les rôles ne sont pas appliqués : ce trou reste dans `gaps`.
 */

export const ADMIN_COOKIE_NAME = "mq_admin_session";
export const ADMIN_SESSION_VERSION = 1;
export const MAX_ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;

export const ADMIN_ROLES = [
  "owner",
  "editor",
  "analyst",
  "integration_manager",
  "automation_manager",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  owner: "propriétaire",
  editor: "édition",
  analyst: "analyse",
  integration_manager: "intégrations",
  automation_manager: "automatisations",
};

export const ADMIN_GAPS = [
  "mfa_not_enforced",
  "rbac_not_enforced",
  "no_persistent_user_store",
] as const;

export type AdminGap = (typeof ADMIN_GAPS)[number];

export type AdminSession = {
  readonly subject: string;
  readonly role: AdminRole;
  readonly expiresAt: string;
  readonly mfaSatisfied: boolean;
};

export type AccessDenialReason =
  | "missing_session"
  | "auth_not_configured"
  | "invalid_session"
  | "expired_session";

export type AccessDecision =
  | {
      readonly allowed: false;
      readonly httpStatus: 401;
      readonly reason: AccessDenialReason;
    }
  | {
      readonly allowed: true;
      readonly httpStatus: 200;
      readonly session: AdminSession;
      readonly gaps: readonly AdminGap[];
    };

const SUBJECT = /^[\p{L}\p{N} ._@+-]{1,80}$/u;

type SessionPayload = {
  v: number;
  sub: string;
  role: AdminRole;
  exp: number;
  mfa: boolean;
};

const PAYLOAD_KEYS = ["v", "sub", "role", "exp", "mfa"] as const;

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  const pad = (4 - (value.length % 4)) % 4;
  try {
    const binary = atob(value.replaceAll("-", "+").replaceAll("_", "/") + "=".repeat(pad));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function deny(reason: AccessDenialReason): AccessDecision {
  return { allowed: false, httpStatus: 401, reason };
}

function isAdminRole(value: unknown): value is AdminRole {
  return typeof value === "string" && (ADMIN_ROLES as readonly string[]).includes(value);
}

function readPayload(encoded: string): SessionPayload | null {
  const bytes = base64UrlToBytes(encoded);
  if (!bytes) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const keys = Object.keys(parsed);
  if (keys.length !== PAYLOAD_KEYS.length || !keys.every((key) => (PAYLOAD_KEYS as readonly string[]).includes(key))) {
    return null;
  }
  const record = parsed as Record<string, unknown>;
  if (record.v !== ADMIN_SESSION_VERSION) return null;
  if (typeof record.sub !== "string" || !SUBJECT.test(record.sub)) return null;
  if (!isAdminRole(record.role)) return null;
  if (!Number.isSafeInteger(record.exp)) return null;
  if (typeof record.mfa !== "boolean") return null;
  return {
    v: ADMIN_SESSION_VERSION,
    sub: record.sub,
    role: record.role,
    exp: record.exp as number,
    mfa: record.mfa,
  };
}

export async function issueAdminSessionCookie(input: {
  secret: string;
  subject: string;
  role: AdminRole;
  expiresAt: Date;
  mfaSatisfied?: boolean;
}): Promise<string> {
  if (input.secret.trim() === "") {
    throw new Error("ADMIN_SESSION_SECRET est vide.");
  }
  if (!SUBJECT.test(input.subject) || !isAdminRole(input.role) || Number.isNaN(input.expiresAt.getTime())) {
    throw new Error("Session admin impossible à émettre.");
  }
  const payload: SessionPayload = {
    v: ADMIN_SESSION_VERSION,
    sub: input.subject,
    role: input.role,
    exp: input.expiresAt.getTime(),
    mfa: input.mfaSatisfied === true,
  };
  const encoded = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)));
  const key = await hmacKey(input.secret);
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(encoded));
  return `${encoded}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function authorizeAdminRequest(input: {
  secret: string | undefined;
  cookieValue: string | undefined;
  now: Date;
}): Promise<AccessDecision> {
  if (input.secret === undefined || input.secret.trim() === "") {
    return deny("auth_not_configured");
  }
  if (input.cookieValue === undefined || input.cookieValue.trim() === "") {
    return deny("missing_session");
  }

  const parts = input.cookieValue.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return deny("invalid_session");
  const signature = base64UrlToBytes(parts[1]);
  if (!signature || signature.byteLength !== 32) return deny("invalid_session");

  const key = await hmacKey(input.secret);
  const signatureBytes = new Uint8Array(new ArrayBuffer(signature.byteLength));
  signatureBytes.set(signature);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(parts[0]),
  );
  if (!valid) return deny("invalid_session");

  const payload = readPayload(parts[0]);
  if (!payload) return deny("invalid_session");
  if (payload.exp <= input.now.getTime()) return deny("expired_session");
  if (payload.exp > input.now.getTime() + MAX_ADMIN_SESSION_MS) return deny("invalid_session");

  return {
    allowed: true,
    httpStatus: 200,
    session: {
      subject: payload.sub,
      role: payload.role,
      expiresAt: new Date(payload.exp).toISOString(),
      mfaSatisfied: payload.mfa,
    },
    gaps: payload.mfa
      ? ["rbac_not_enforced", "no_persistent_user_store"]
      : ["mfa_not_enforced", "rbac_not_enforced", "no_persistent_user_store"],
  };
}

export function serializeAdminCookie(value: string, options: { maxAgeSeconds: number; secure: boolean }): string {
  const parts = [
    `${ADMIN_COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${options.maxAgeSeconds}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearAdminCookie(secure: boolean): string {
  const parts = [`${ADMIN_COOKIE_NAME}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export const ADMIN_REFUSAL_COPY = {
  title: "Authentification requise",
  lead: "Cette zone d'administration refuse la demande : aucune session valide n'est présentée.",
  mfa: "Le second facteur TOTP n'est évalué qu'à la connexion, et seulement s'il est configuré. S'il est vide, il ne protège pas cette zone.",
  scope: "Les réglages ne s'affichent pas sans session. Les leads et les webhooks ne sont pas livrés.",
  login: "Ouvrir la page de connexion",
  back: "Retour à l'accueil",
} as const;

export function renderAdminRefusalDocument(): string {
  const copy = ADMIN_REFUSAL_COPY;
  return `<!DOCTYPE html>
<html lang="fr-CA">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${copy.title}</title>
  <style>
    :root { color-scheme: light; }
    body { margin: 0; font-family: Georgia, "Iowan Old Style", serif; background: #f3efe6; color: #1b2421; }
    main { max-width: 38rem; margin: 0 auto; padding: 4rem 1.25rem; }
    h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 1rem; }
    p { line-height: 1.5; font-family: "Segoe UI", sans-serif; }
    a { color: #0f4c3a; }
  </style>
</head>
<body>
  <main>
    <h1>${copy.title}</h1>
    <p>${copy.lead}</p>
    <p>${copy.mfa}</p>
    <p>${copy.scope}</p>
    <p><a href="/admin/login">${copy.login}</a></p>
    <p><a href="/">${copy.back}</a></p>
  </main>
</body>
</html>`;
}
