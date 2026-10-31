"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { saveEventDefinition, setEventDefinitionEnabled } from "@/server/event-catalog";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export async function saveEventDefinitionAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "events.manage")) forbidden();
  const result = saveEventDefinition(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    name: String(formData.get("name") ?? ""),
    trigger: String(formData.get("trigger") ?? ""),
    schemaVersion: String(formData.get("schema_version") ?? ""),
    funnelName: String(formData.get("funnel_name") ?? ""),
    consentRequired: formData.get("consent_required") === "off" ? false : undefined,
    now: new Date(),
  });
  redirect(result.ok ? "/admin/events?enregistre=1" : `/admin/events?erreur=${result.reason}`);
}

export async function setEventDefinitionEnabledAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "events.manage")) forbidden();
  const result = setEventDefinitionEnabled(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    id: String(formData.get("id") ?? ""),
    enabled: formData.get("enabled") === "1",
    now: new Date(),
  });
  redirect(result.ok ? "/admin/events?enregistre=1" : "/admin/events?erreur=missing");
}
