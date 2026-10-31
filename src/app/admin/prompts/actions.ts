"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { requestEditorialGeneration } from "@/server/editorial-generation";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";

export async function generateEditorialAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "prompts.read")) forbidden();
  const result = requestEditorialGeneration({ apiKey: process.env.OPENROUTER_API_KEY });
  redirect(result.message === "à connecter" ? "/admin/prompts?generation=a-connecter" : "/admin/prompts?generation=non-branchee");
}
