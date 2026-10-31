"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { saveWebhookDestination } from "@/server/acquisition";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export async function saveWebhookDestinationAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "webhooks.manage")) forbidden();
  const result = saveWebhookDestination(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    name: String(formData.get("name") ?? ""),
    url: String(formData.get("url") ?? ""),
    secret: String(formData.get("secret") ?? ""),
    sessionSecret: process.env.ADMIN_SESSION_SECRET ?? "",
    now: new Date(),
  });
  redirect(result.ok ? "/admin/integrations/webhooks?enregistre=1" : `/admin/integrations/webhooks?erreur=${result.reason}`);
}
