"use server";

import { unauthorized, redirect } from "next/navigation";
import { readCurrentAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";
import { SETTING_KEYS, saveSettings, type SettingKey } from "@/server/settings-db";

export async function saveSiteSettingsAction(formData: FormData) {
  const decision = await readCurrentAdmin();
  if (!decision.allowed) unauthorized();
  const values = Object.fromEntries(
    SETTING_KEYS.map((key) => [key, String(formData.get(key) ?? "")]),
  ) as Record<SettingKey, string>;
  const result = saveSettings(settingsDatabase(process.env), values);
  redirect(result.ok ? "/admin/settings?enregistre=1" : "/admin/settings?erreur=1");
}
