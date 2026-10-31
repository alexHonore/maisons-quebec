"use server";

import { redirect } from "next/navigation";
import { netProceedsInputFromFields } from "@/domain/net-proceeds-form";
import { readNetProceedsLink } from "@/domain/net-proceeds-link";
import { captureLead, dispatchPendingOutbox, postWebhookRequest, saveNetProceedsDraft } from "@/server/acquisition";
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

function followUpBack(draftId: string, linkHref: string | null, reason: string): string {
  if (draftId) return `/vendre/calculateur-produit-net?resultat=${encodeURIComponent(draftId)}&erreur=${reason}`;
  if (linkHref && linkHref.includes("?")) return `${linkHref}&erreur=${reason}`;
  return `/vendre/calculateur-produit-net?erreur=${reason}`;
}

export async function requestFollowUpAction(formData: FormData) {
  const db = settingsDatabase(process.env);
  let draftId = String(formData.get("draft_id") ?? "").trim();
  const link = readNetProceedsLink({
    vente: String(formData.get("vente") ?? ""),
    hypotheque: String(formData.get("hypotheque") ?? ""),
    courtage: String(formData.get("courtage") ?? ""),
    valeur: String(formData.get("valeur") ?? ""),
    taxe_a: String(formData.get("taxe_a") ?? ""),
    taxe_b: String(formData.get("taxe_b") ?? ""),
    penalite: String(formData.get("penalite") ?? ""),
    legal: String(formData.get("legal") ?? ""),
    autres: String(formData.get("autres") ?? ""),
  });
  const linkHref = link.present ? link.href : null;
  if (formData.get("consent_respond") !== "on") {
    redirect(followUpBack(draftId, linkHref, "consentement"));
  }
  if (!draftId) {
    if (!link.present || !link.ok) redirect(followUpBack("", null, "saisie"));
    draftId = saveNetProceedsDraft(db, link.input);
  }
  const saved = captureLead(db, {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
    consentToRespond: true,
    consentMarketing: formData.get("consent_marketing") === "on",
    draftId,
  });
  if (!saved.ok) {
    redirect(followUpBack(draftId, linkHref, "contact"));
  }
  try {
    await dispatchPendingOutbox(db, {
      now: new Date(),
      sessionSecret: process.env.ADMIN_SESSION_SECRET ?? "",
      transport: postWebhookRequest,
    });
  } catch {
    // La demande est déjà enregistrée. L'échec de livraison ne la retire pas.
  }
  redirect("/vendre/calculateur-produit-net?demande=recue");
}
