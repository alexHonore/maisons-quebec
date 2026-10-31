"use server";

import { forbidden, redirect, unauthorized } from "next/navigation";
import { confirmAppointment } from "@/server/acquisition";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export async function confirmAppointmentAction(formData: FormData) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "appointments.confirm")) forbidden();
  const result = confirmAppointment(settingsDatabase(process.env), {
    actorId: live.user.id,
    actorRole: live.user.role,
    leadId: String(formData.get("lead_id") ?? ""),
    slot: String(formData.get("slot") ?? ""),
    now: new Date(),
  });
  if (result.ok) redirect("/admin/leads?confirme=1");
  const code = result.reason === "invalid_slot" ? "creneau" : result.reason === "already_confirmed" ? "deja" : "absent";
  redirect(`/admin/leads?erreur=${code}`);
}
