"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { ADMIN_ROLES, type AdminRole } from "@/server/admin-access";
import { createAdminAccount, disableAdminAccount } from "@/server/admin-accounts";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

function isRole(value: string): value is AdminRole {
  return (ADMIN_ROLES as readonly string[]).includes(value);
}

export async function createAdminAccountAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "users.manage")) forbidden();
  const roleValue = String(formData.get("role") ?? "");
  if (!isRole(roleValue)) forbidden();
  const result = createAdminAccount(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    role: roleValue,
    now: new Date(),
  });
  redirect(result.ok ? "/admin/team?enregistre=1" : `/admin/team?erreur=${result.reason}`);
}

export async function disableAdminAccountAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "users.manage")) forbidden();
  const result = disableAdminAccount(settingsDatabase(process.env), {
    actorRole: live.user.role,
    actorId: live.user.id,
    targetId: String(formData.get("id") ?? ""),
  });
  redirect(result.ok ? "/admin/team?enregistre=1" : `/admin/team?erreur=${result.reason}`);
}
