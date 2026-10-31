"use server";

import { redirect } from "next/navigation";
import { FUNNEL_PATHS, isHonestFunnelName, parseFunnelFields } from "@/domain/honest-funnels";
import { captureLead, dispatchPendingOutbox, saveFunnelDraft } from "@/server/acquisition";
import { settingsDatabase } from "@/server/public-site";

function formFields(formData: FormData): { [key: string]: string } {
  const fields: { [key: string]: string } = {};
  const tasks: string[] = [];
  for (const [key, value] of formData.entries()) {
    if (typeof value !== "string") continue;
    if (key === "tasks") tasks.push(value);
    else if (!(key in fields)) fields[key] = value;
  }
  if (tasks.length > 0) fields.tasks = tasks.join(",");
  return fields;
}

function followUpError(reason: string): string {
  if (reason === "consent_required") return "consentement";
  if (reason === "appointment_window_required") return "creneau";
  return "contact";
}

export async function saveHonestFunnelAction(formData: FormData) {
  const funnel = String(formData.get("funnel") ?? "");
  if (!isHonestFunnelName(funnel)) redirect("/");
  const path = FUNNEL_PATHS[funnel];
  const parsed = parseFunnelFields(funnel, formFields(formData));
  if (!parsed.ok) redirect(`${path}?erreur=saisie`);
  const id = saveFunnelDraft(settingsDatabase(process.env), parsed.draft);
  redirect(`${path}?resultat=${id}`);
}

export async function requestHonestFollowUpAction(formData: FormData) {
  const funnel = String(formData.get("funnel") ?? "");
  const draftId = String(formData.get("draft_id") ?? "");
  if (!isHonestFunnelName(funnel)) redirect("/");
  const path = FUNNEL_PATHS[funnel];
  const saved = captureLead(settingsDatabase(process.env), {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    consentToRespond: formData.get("consent_respond") === "on",
    consentMarketing: formData.get("consent_marketing") === "on",
    draftId,
    funnelName: funnel,
    requestAppointment: formData.get("appointment") === "on",
    appointmentWindow: String(formData.get("appointment_window") ?? ""),
  });
  if (!saved.ok) {
    redirect(`${path}?resultat=${encodeURIComponent(draftId)}&erreur=${followUpError(saved.reason)}`);
  }
  try {
    await dispatchPendingOutbox(settingsDatabase(process.env), {
      now: new Date(),
      sessionSecret: process.env.ADMIN_SESSION_SECRET ?? "",
      transport: async ({ url, body, headers }) => {
        const response = await fetch(url, { method: "POST", headers, body, redirect: "manual" });
        return { status: response.status };
      },
    });
  } catch {
    // La demande est déjà enregistrée. L'échec de livraison ne la retire pas.
  }
  redirect(`${path}?demande=recue${saved.duplicate ? "&doublon=1" : ""}`);
}
