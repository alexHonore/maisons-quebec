"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { requestN8nConnection } from "@/domain/automation";
import { importAutomationJson, previewAutomation, saveAutomation, setAutomationEnabled } from "@/server/automations";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export async function saveAutomationAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "automations.manage")) forbidden();
  const result = saveAutomation(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    name: String(formData.get("name") ?? ""),
    trigger: String(formData.get("trigger") ?? ""),
    action: String(formData.get("action") ?? ""),
    now: new Date(),
  });
  redirect(result.ok ? "/admin/automations?enregistre=1" : `/admin/automations?erreur=${result.reason}`);
}

export async function setAutomationEnabledAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "automations.manage")) forbidden();
  const result = setAutomationEnabled(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    id: String(formData.get("id") ?? ""),
    enabled: formData.get("enabled") === "1",
    now: new Date(),
  });
  redirect(result.ok ? "/admin/automations?enregistre=1" : "/admin/automations?erreur=missing");
}

export async function importAutomationAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "automations.manage")) forbidden();
  const result = importAutomationJson(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    body: String(formData.get("document") ?? ""),
    now: new Date(),
  });
  redirect(result.ok ? "/admin/automations?enregistre=1" : `/admin/automations?erreur=${result.reason}`);
}

export async function previewAutomationAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "automations.manage")) forbidden();
  const id = String(formData.get("id") ?? "");
  const result = previewAutomation(settingsDatabase(process.env), { actorRole: live.user.role, id });
  if (!result.ok || !/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/automations?erreur=missing");
  redirect(`/admin/automations?essai=${id}`);
}

export async function checkN8nAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "automations.manage")) forbidden();
  const result = requestN8nConnection({ baseUrl: process.env.N8N_BASE_URL });
  redirect(result.message === "à connecter" ? "/admin/automations?n8n=a-connecter" : "/admin/automations?n8n=non-branche");
}
