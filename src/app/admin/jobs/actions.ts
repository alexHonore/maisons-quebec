"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { runSettingsPresenceJob } from "@/server/job-journal";
import { settingsDatabase } from "@/server/public-site";

export async function runSettingsPresenceJobAction() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "jobs.run_demo")) forbidden();
  runSettingsPresenceJob(settingsDatabase(process.env), live.user.role, new Date());
  redirect("/admin/jobs?enregistre=1");
}
