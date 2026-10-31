import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { ADMIN_ROLES, type AdminRole } from "./admin-access";
import {
  countOwners,
  createAdminAccount,
  createOwnerFromBootstrap,
  disableAdminAccount,
  findAdminById,
} from "./admin-accounts";
import { ADMIN_PERMISSIONS, planSettingsUpdate, roleCan } from "./admin-permissions";
import { listJobRuns, runSettingsPresenceJob } from "./job-journal";
import { MIGRATIONS, migrateDown, migrateUp, readStoredSettings, saveSettings } from "./settings-db";

const now = new Date("2026-10-31T21:30:00.000Z");

function freshDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  migrateUp(db);
  return db;
}

describe("comptes admin", () => {
  it("crée le premier propriétaire seulement par amorçage, puis les autres rôles", () => {
    const sql = MIGRATIONS.map((migration) => `${migration.up}\n${migration.down}`).join("\n");
    assert.equal(sql.includes("INSERT"), false);
    const db = freshDb();
    assert.equal(
      createAdminAccount(db, {
        actorId: "personne",
        actorRole: "owner",
        email: "editeur@example.com",
        password: "phrase-de-test-seulement",
        role: "editor",
        now,
      }).ok,
      false,
    );
    const owner = createOwnerFromBootstrap(db, {
      email: "owner@example.com",
      password: "phrase-de-test-seulement",
      now,
    });
    assert.equal(owner.ok, true);
    assert.equal(createOwnerFromBootstrap(db, { email: "autre@example.com", password: "phrase-de-test-seulement", now }).ok, false);
    assert.equal(countOwners(db), 1);
    for (const role of ADMIN_ROLES) {
      if (role === "owner") continue;
      const created = createAdminAccount(db, {
        actorId: owner.ok ? owner.account.id : "personne",
        actorRole: "owner",
        email: `${role}@example.com`,
        password: "phrase-de-test-seulement",
        role,
        now,
      });
      assert.equal(created.ok, true);
      if (!created.ok) continue;
      assert.equal(created.account.role, role);
    }
    assert.equal(
      createAdminAccount(db, {
        actorId: owner.ok ? owner.account.id : "personne",
        actorRole: "editor",
        email: "autre-editeur@example.com",
        password: "phrase-de-test-seulement",
        role: "analyst",
        now,
      }).ok,
      false,
    );
    const editor = findAdminById(db, `${"not-an-id"}`);
    assert.equal(editor, null);
    migrateDown(db);
    assert.throws(() => db.prepare("SELECT id FROM admin_users").all());
    assert.throws(() => db.prepare("SELECT id FROM job_runs").all());
    db.close();
  });

  it("refuse de désactiver le dernier propriétaire", () => {
    const db = freshDb();
    const owner = createOwnerFromBootstrap(db, {
      email: "owner@example.com",
      password: "phrase-de-test-seulement",
      now,
    });
    assert.equal(owner.ok, true);
    if (!owner.ok) return;
    assert.equal(disableAdminAccount(db, { actorRole: "owner", actorId: owner.account.id, targetId: owner.account.id }).ok, false);
    const editor = createAdminAccount(db, {
      actorId: owner.account.id,
      actorRole: "owner",
      email: "editeur@example.com",
      password: "phrase-de-test-seulement",
      role: "editor",
      now,
    });
    assert.equal(editor.ok, true);
    if (!editor.ok) return;
    assert.equal(disableAdminAccount(db, { actorRole: "editor", actorId: editor.account.id, targetId: owner.account.id }).ok, false);
    assert.equal(disableAdminAccount(db, { actorRole: "owner", actorId: owner.account.id, targetId: editor.account.id }).ok, true);
    assert.equal(findAdminById(db, editor.account.id)?.disabled, true);
    db.close();
  });
});

describe("permissions", () => {
  it("applique le moindre privilège sur les cinq rôles", () => {
    const matrix: Record<AdminRole, Array<keyof typeof ADMIN_PERMISSIONS>> = {
      owner: ["settings.copy.write", "settings.regulatory.write", "users.manage", "jobs.read", "jobs.run_demo", "audit.read", "leads.read", "leads.aggregate", "webhooks.manage", "appointments.confirm", "events.read", "events.manage", "content.write", "content.preview", "content.publish", "media.manage", "prompts.read", "prompts.write", "analytics.read", "automations.manage"],
      editor: ["settings.copy.write", "content.write", "content.preview", "media.manage", "prompts.read", "prompts.write"],
      analyst: ["jobs.read", "leads.aggregate", "events.read", "analytics.read"],
      integration_manager: ["webhooks.manage", "events.read", "events.manage"],
      automation_manager: ["jobs.read", "jobs.run_demo", "automations.manage"],
    };
    for (const role of ADMIN_ROLES) {
      for (const permission of Object.keys(ADMIN_PERMISSIONS) as Array<keyof typeof ADMIN_PERMISSIONS>) {
        assert.equal(roleCan(role, permission), matrix[role].includes(permission), `${role} ${permission}`);
      }
    }
  });

  it("empêche un éditeur de modifier un permis, même s'il change aussi le titre", () => {
    const current = {
      brand_name: "",
      hero_title: "Ancien",
      hero_promise: "",
      hero_subpromise: "",
      broker_oaciq_permit: "",
      agency_name: "",
      agency_permit: "",
    };
    const editor = planSettingsUpdate("editor", current, { hero_title: "Nouveau", broker_oaciq_permit: "PERMIS-SAISI" });
    assert.deepEqual(editor, { ok: false, status: 403 });
    const allowed = planSettingsUpdate("editor", current, { hero_title: "Nouveau" });
    assert.equal(allowed.ok, true);
    const analyst = planSettingsUpdate("analyst", current, { hero_title: "Nouveau" });
    assert.equal(analyst.ok, false);
    const owner = planSettingsUpdate("owner", current, { broker_oaciq_permit: "PERMIS-SAISI" });
    assert.equal(owner.ok, true);
  });
});

describe("journal de jobs", () => {
  it("enregistre un contrôle sans recopier le permis ni un courriel", () => {
    const db = freshDb();
    const permit = "PERMIS-NE-DOIT-PAS-FUITER";
    saveSettings(db, { broker_oaciq_permit: permit, agency_name: "" });
    const owner = createOwnerFromBootstrap(db, {
      email: "owner@example.com",
      password: "phrase-de-test-seulement",
      now,
    });
    assert.equal(owner.ok, true);
    const run = runSettingsPresenceJob(db, "automation_manager", now);
    assert.equal(run.status, "succeeded");
    assert.equal(run.summary.includes(permit), false);
    assert.equal(run.summary.includes("owner@example.com"), false);
    assert.match(run.summary, /permis du courtier/);
    assert.match(run.summary, /Aucune statistique produite/);
    assert.equal(run.summary.includes(readStoredSettings(db).broker_oaciq_permit), false);
    const listed = listJobRuns(db);
    assert.equal(listed.length, 1);
    assert.equal(listed[0]?.actorRole, "automation_manager");
    db.close();
  });
});
