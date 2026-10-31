"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { readLiveAdmin } from "@/server/current-admin";
import { planSettingsUpdate } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";
import { readStoredSettings, saveSettings, SETTING_KEYS, type SettingKey } from "@/server/settings-db";

export async function saveSiteSettingsAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  const db = settingsDatabase(process.env);
  const current = readStoredSettings(db);
  const submitted: Partial<Record<SettingKey, string>> = {};
  for (const key of SETTING_KEYS) {
    if (formData.has(key)) submitted[key] = String(formData.get(key) ?? "");
  }
  const plan = planSettingsUpdate(live.user.role, current, submitted);
  if (!plan.ok) forbidden();
  const result = saveSettings(db, plan.values);
  redirect(result.ok ? "/admin/settings?enregistre=1" : "/admin/settings?erreur=1");
}
