"use server";

import { redirect } from "next/navigation";
import { netProceedsInputFromFields } from "@/domain/net-proceeds-form";
import { captureLead, dispatchPendingOutbox, saveNetProceedsDraft } from "@/server/acquisition";
import { settingsDatabase } from "@/server/public-site";

export async function calculateNetProceedsAction(formData: FormData) {
  const parsed = netProceedsInputFromFields({
    sale: String(formData.get("sale") ?? ""),
    mortgage: String(formData.get("mortgage") ?? ""),
    brokerageKind: String(formData.get("brokerage_kind") ?? "fixed"),
    brokerageValue: String(formData.get("brokerage_value") ?? ""),
    taxA: String(formData.get("tax_a") ?? ""),
    taxB: String(formData.get("tax_b") ?? ""),
    penalty: String(formData.get("penalty") ?? ""),
    legal: String(formData.get("legal") ?? ""),
    other: String(formData.get("other") ?? ""),
  });
  if (!parsed.ok) redirect("/vendre/calculateur-produit-net?erreur=saisie");
  const id = saveNetProceedsDraft(settingsDatabase(process.env), parsed.input);
  redirect(`/vendre/calculateur-produit-net?resultat=${id}`);
}

export async function requestFollowUpAction(formData: FormData) {
  const draftId = String(formData.get("draft_id") ?? "");
  const saved = captureLead(settingsDatabase(process.env), {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    consentToRespond: formData.get("consent_respond") === "on",
    consentMarketing: formData.get("consent_marketing") === "on",
    draftId,
  });
  if (!saved.ok) {
    const reason = saved.reason === "consent_required" ? "consentement" : "contact";
    redirect(`/vendre/calculateur-produit-net?resultat=${encodeURIComponent(draftId)}&erreur=${reason}`);
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
  redirect("/vendre/calculateur-produit-net?demande=recue");
}
