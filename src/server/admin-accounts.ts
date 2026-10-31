import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { ADMIN_ROLES, type AdminRole } from "./admin-access";
import { recordAdminAudit } from "./admin-audit";

export const MIN_ADMIN_PASSWORD_LENGTH = 12;

export type AdminAccount = {
  readonly id: string;
  readonly email: string;
  readonly role: AdminRole;
  readonly disabled: boolean;
  readonly createdAt: string;
};

type AccountRow = {
  id: string;
  email: string;
  password_hash: string;
  password_salt: string;
  role: string;
  disabled: number;
  created_at: string;
};

function isRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

function toAccount(row: AccountRow): AdminAccount {
  if (!isRole(row.role)) throw new Error("Rôle admin illisible.");
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    disabled: row.disabled === 1,
    createdAt: row.created_at,
  };
}

export function hashAdminPassword(password: string, salt = randomBytes(16)): { hash: string; salt: string } {
  return {
    hash: scryptSync(password, salt, 32).toString("base64"),
    salt: salt.toString("base64"),
  };
}

export function passwordMatchesHash(password: string, salt: string, hash: string): boolean {
  const actual = scryptSync(password, Buffer.from(salt, "base64"), 32);
  const expected = Buffer.from(hash, "base64");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function countOwners(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS total FROM admin_users WHERE role = 'owner' AND disabled = 0").get();
  return Number(row?.total ?? 0);
}

export function listAdminAccounts(db: DatabaseSync): AdminAccount[] {
  return db
    .prepare(
      "SELECT id, email, password_hash, password_salt, role, disabled, created_at FROM admin_users ORDER BY created_at ASC",
    )
    .all()
    .map((row) => toAccount(row as AccountRow));
}

export function findAdminByEmail(db: DatabaseSync, email: string): (AdminAccount & { passwordHash: string; passwordSalt: string }) | null {
  const row = db
    .prepare(
      "SELECT id, email, password_hash, password_salt, role, disabled, created_at FROM admin_users WHERE email = ?",
    )
    .get(email.trim().toLowerCase()) as AccountRow | undefined;
  if (!row) return null;
  const account = toAccount(row);
  return { ...account, passwordHash: row.password_hash, passwordSalt: row.password_salt };
}

export function findAdminById(db: DatabaseSync, id: string): AdminAccount | null {
  const row = db
    .prepare("SELECT id, email, password_hash, password_salt, role, disabled, created_at FROM admin_users WHERE id = ?")
    .get(id) as AccountRow | undefined;
  return row ? toAccount(row) : null;
}

export function createOwnerFromBootstrap(
  db: DatabaseSync,
  input: { email: string; password: string; now: Date },
): { ok: true; account: AdminAccount } | { ok: false; reason: "owner_exists" | "password_too_short" | "email_invalid" } {
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || email.length > 120) return { ok: false, reason: "email_invalid" };
  if (input.password.length < MIN_ADMIN_PASSWORD_LENGTH) return { ok: false, reason: "password_too_short" };
  db.exec("BEGIN");
  try {
    if (countOwners(db) > 0) {
      db.exec("ROLLBACK");
      return { ok: false, reason: "owner_exists" };
    }
    const id = randomUUID();
    const secret = hashAdminPassword(input.password);
    db.prepare(
      `INSERT INTO admin_users (id, email, password_hash, password_salt, role, disabled, created_at)
       VALUES (?, ?, ?, ?, 'owner', 0, ?)`,
    ).run(id, email, secret.hash, secret.salt, input.now.toISOString());
    db.exec("COMMIT");
    const account = findAdminById(db, id);
    if (!account) throw new Error("Compte propriétaire illisible après création.");
    recordAdminAudit(db, { actorId: id, actorRole: "owner", action: "account.created", subjectId: id, at: input.now });
    return { ok: true, account };
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function createAdminAccount(
  db: DatabaseSync,
  input: { actorId: string; actorRole: AdminRole; email: string; password: string; role: AdminRole; now: Date },
): { ok: true; account: AdminAccount } | { ok: false; reason: "forbidden" | "bootstrap_required" | "email_invalid" | "email_taken" | "password_too_short" | "role_invalid" } {
  if (input.actorRole !== "owner") return { ok: false, reason: "forbidden" };
  if (countOwners(db) === 0) return { ok: false, reason: "bootstrap_required" };
  if (!isRole(input.role)) return { ok: false, reason: "role_invalid" };
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+$/.test(email) || email.length > 120) return { ok: false, reason: "email_invalid" };
  if (input.password.length < MIN_ADMIN_PASSWORD_LENGTH) return { ok: false, reason: "password_too_short" };
  if (findAdminByEmail(db, email)) return { ok: false, reason: "email_taken" };
  const id = randomUUID();
  const secret = hashAdminPassword(input.password);
  db.prepare(
    `INSERT INTO admin_users (id, email, password_hash, password_salt, role, disabled, created_at)
     VALUES (?, ?, ?, ?, ?, 0, ?)`,
  ).run(id, email, secret.hash, secret.salt, input.role, input.now.toISOString());
  const account = findAdminById(db, id);
  if (!account) throw new Error("Compte admin illisible après création.");
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "account.created",
    subjectId: id,
    at: input.now,
  });
  return { ok: true, account };
}

export function disableAdminAccount(
  db: DatabaseSync,
  input: { actorRole: AdminRole; actorId: string; targetId: string },
): { ok: true } | { ok: false; reason: "forbidden" | "missing" | "last_owner" } {
  if (input.actorRole !== "owner") return { ok: false, reason: "forbidden" };
  const target = findAdminById(db, input.targetId);
  if (!target) return { ok: false, reason: "missing" };
  if (target.role === "owner" && countOwners(db) <= 1) return { ok: false, reason: "last_owner" };
  db.prepare("UPDATE admin_users SET disabled = 1 WHERE id = ?").run(target.id);
  recordAdminAudit(db, {
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: "account.disabled",
    subjectId: target.id,
    at: new Date(),
  });
  return { ok: true };
}
