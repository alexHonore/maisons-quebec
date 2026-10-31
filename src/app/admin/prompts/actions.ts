"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { requestEditorialGeneration } from "@/server/editorial-generation";
import { savePromptLayer } from "@/server/prompt-layers";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export async function generateEditorialAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "prompts.read")) forbidden();
  const result = requestEditorialGeneration({ apiKey: process.env.OPENROUTER_API_KEY });
  redirect(result.message === "à connecter" ? "/admin/prompts?generation=a-connecter" : "/admin/prompts?generation=non-branchee");
}

export async function savePromptLayerAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "prompts.write")) forbidden();
  const result = savePromptLayer(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    layer: String(formData.get("layer") ?? ""),
    body: String(formData.get("body") ?? ""),
    now: new Date(),
  });
  redirect(result.ok ? "/admin/prompts?enregistre=1" : `/admin/prompts?erreur=${result.reason}`);
}
