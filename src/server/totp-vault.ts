import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";
import { encodeBase32, verifyTotp } from "./totp";

export const PRIVILEGED_ADMIN_ROLES = ["owner", "integration_manager", "automation_manager"] as const;

export function isPrivilegedAdminRole(role: AdminRole): boolean {
  return (PRIVILEGED_ADMIN_ROLES as readonly string[]).includes(role);
}

export function totpKeyFromSessionSecret(sessionSecret: string): Buffer | null {
  if (sessionSecret.trim() === "") return null;
  return scryptSync(sessionSecret, "maisons-quebec-totp-v1", 32);
}

export function encryptTotpSecret(secret: Uint8Array, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptTotpSecret(payload: string, key: Buffer): Uint8Array | null {
  try {
    const bytes = Buffer.from(payload, "base64");
    if (bytes.length < 12 + 16 + 1) return null;
    const iv = bytes.subarray(0, 12);
    const tag = bytes.subarray(12, 28);
    const ciphertext = bytes.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return new Uint8Array(Buffer.concat([decipher.update(ciphertext), decipher.final()]));
  } catch {
    return null;
  }
}

export type TotpAccountState = "absent" | "pending" | "confirmed";

export function totpAccountState(db: DatabaseSync, userId: string): TotpAccountState {
  const row = db.prepare("SELECT confirmed FROM admin_totp WHERE user_id = ?").get(userId);
  if (!row) return "absent";
  return Number(row.confirmed) === 1 ? "confirmed" : "pending";
}

export function beginTotpEnrollment(
  db: DatabaseSync,
  input: { userId: string; actorRole: AdminRole; key: Buffer; now: Date; secret?: Uint8Array },
): { ok: true; secretBase32: string } | { ok: false; reason: "already_confirmed" | "not_privileged" } {
  if (!isPrivilegedAdminRole(input.actorRole)) return { ok: false, reason: "not_privileged" };
  if (totpAccountState(db, input.userId) === "confirmed") return { ok: false, reason: "already_confirmed" };
  const secret = input.secret ?? randomBytes(20);
  const secretBase32 = encodeBase32(secret);
  const ciphertext = encryptTotpSecret(secret, input.key);
  db.prepare(
    `INSERT INTO admin_totp (user_id, secret_ciphertext, confirmed, created_at)
     VALUES (?, ?, 0, ?)
     ON CONFLICT(user_id) DO UPDATE SET secret_ciphertext = excluded.secret_ciphertext, confirmed = 0, created_at = excluded.created_at`,
  ).run(input.userId, ciphertext, input.now.toISOString());
  recordAdminAudit(db, {
    actorId: input.userId,
    actorRole: input.actorRole,
    action: "totp.enrollment_started",
    subjectId: input.userId,
    at: input.now,
  });
  return { ok: true, secretBase32 };
}

export function confirmTotpEnrollment(
  db: DatabaseSync,
  input: { userId: string; actorRole: AdminRole; key: Buffer; code: string; now: Date },
): { ok: true } | { ok: false; reason: "missing" | "invalid_code" | "not_privileged" } {
  if (!isPrivilegedAdminRole(input.actorRole)) return { ok: false, reason: "not_privileged" };
  const row = db.prepare("SELECT secret_ciphertext, confirmed FROM admin_totp WHERE user_id = ?").get(input.userId);
  if (!row) return { ok: false, reason: "missing" };
  if (Number(row.confirmed) === 1) return { ok: true };
  const secret = decryptTotpSecret(String(row.secret_ciphertext), input.key);
  if (!secret || !verifyTotp(secret, input.code.trim(), input.now.getTime())) return { ok: false, reason: "invalid_code" };
  db.prepare("UPDATE admin_totp SET confirmed = 1 WHERE user_id = ?").run(input.userId);
  recordAdminAudit(db, {
    actorId: input.userId,
    actorRole: input.actorRole,
    action: "totp.confirmed",
    subjectId: input.userId,
    at: input.now,
  });
  return { ok: true };
}

export function confirmedTotpSecret(db: DatabaseSync, userId: string, key: Buffer): Uint8Array | "missing" | "unreadable" {
  const row = db.prepare("SELECT secret_ciphertext, confirmed FROM admin_totp WHERE user_id = ?").get(userId);
  if (!row || Number(row.confirmed) !== 1) return "missing";
  const secret = decryptTotpSecret(String(row.secret_ciphertext), key);
  return secret ?? "unreadable";
}

export function storedTotpCiphertext(db: DatabaseSync, userId: string): string | null {
  const row = db.prepare("SELECT secret_ciphertext FROM admin_totp WHERE user_id = ?").get(userId);
  return row ? String(row.secret_ciphertext) : null;
}

export function renderTotpStatus(input: {
  state: TotpAccountState;
  sessionMfa: boolean;
  globalSecretConfigured: boolean;
}): string {
  const lines = [
    input.sessionMfa
      ? "Cette session a vérifié un code TOTP."
      : "MFA non actif pour cette session.",
  ];
  if (!input.globalSecretConfigured && input.state !== "confirmed") {
    lines.push("Le secret TOTP global est vide. Le compte d'amorçage n'a pas de second facteur tant qu'il n'en enregistre pas un.");
  }
  if (input.state === "confirmed") {
    lines.push("Un second facteur est enregistré pour ce compte. Le secret n'est pas affiché.");
  } else if (input.state === "pending") {
    lines.push("Un enrôlement est en cours. Le secret n'est pas réaffiché.");
  } else {
    lines.push("Aucun second facteur n'est enregistré pour ce compte.");
  }
  return lines.join(" ");
}

export function renderTotpEnrollment(secretBase32: string): string {
  return `<p>Secret à copier une seule fois : <code>${secretBase32}</code></p>`;
}
