"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { DEMO_JOB_NAME } from "@/server/job-journal";
import { enqueueJob, executeNextJob, retryFailedJob } from "@/server/job-queue";
import { settingsDatabase } from "@/server/public-site";

function guard() {
  return readLiveAdmin();
}

export async function enqueueSettingsJobAction() {
  const live = await guard();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "jobs.run_demo")) forbidden();
  const db = settingsDatabase(process.env);
  enqueueJob(db, { jobName: DEMO_JOB_NAME, actorId: live.user.id, actorRole: live.user.role, now: new Date() });
  redirect("/admin/jobs?enregistre=1");
}

export async function executeQueueAction() {
  const live = await guard();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "jobs.run_demo")) forbidden();
  executeNextJob(settingsDatabase(process.env), { actorId: live.user.id, now: new Date() });
  redirect("/admin/jobs?enregistre=1");
}

export async function retryQueueJobAction(formData: FormData) {
  const live = await guard();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "jobs.run_demo")) forbidden();
  retryFailedJob(settingsDatabase(process.env), {
    id: String(formData.get("id") ?? ""),
    actorId: live.user.id,
    actorRole: live.user.role,
    now: new Date(),
  });
  redirect("/admin/jobs?enregistre=1");
}
