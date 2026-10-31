import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { saveSiteSettingsAction } from "./actions";
import { REGULATORY_EMPTY_LABEL } from "@/domain/regulatory-identity";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";
import { readStoredSettings, type SettingKey } from "@/server/settings-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false, follow: false },
};

const COPY_FIELDS = [
  ["brand_name", "Nom de marque", false],
  ["hero_title", "Titre d'accueil", true],
  ["hero_promise", "Promesse", true],
  ["hero_subpromise", "Sous-promesse", true],
] as const;

const REGULATORY_FIELDS = [
  ["broker_oaciq_permit", "Permis OACIQ du courtier"],
  ["agency_name", "Nom de l'agence"],
  ["agency_permit", "Permis de l'agence"],
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; erreur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  const canCopy = roleCan(live.user.role, "settings.copy.write");
  const canRegulatory = roleCan(live.user.role, "settings.regulatory.write");
  if (!canCopy && !canRegulatory) forbidden();
  const params = await searchParams;
  const stored = readStoredSettings(settingsDatabase(process.env));

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Réglages du site</h1>
      <p>Un champ réglementaire vide reste vide. Seul le propriétaire peut le modifier.</p>
      {params.enregistre === "1" ? <p role="status">Réglages enregistrés.</p> : null}
      {params.erreur === "1" ? <p role="alert">Les réglages n&apos;ont pas été enregistrés.</p> : null}
      <form className="form-grid" action={saveSiteSettingsAction}>
        {canCopy
          ? COPY_FIELDS.map(([key, label, long]) => (
              <label key={key}>
                {label}
                {long ? <textarea name={key} rows={4} defaultValue={stored[key]} /> : <input name={key} defaultValue={stored[key]} />}
              </label>
            ))
          : null}
        {REGULATORY_FIELDS.map(([key, label]) => (
          <label key={key}>
            {label}
            {canRegulatory ? (
              <input name={key} defaultValue={stored[key]} placeholder={REGULATORY_EMPTY_LABEL} autoComplete="off" />
            ) : (
              <span>{stored[key] === "" ? REGULATORY_EMPTY_LABEL : "Renseigné"}</span>
            )}
          </label>
        ))}
        <button type="submit">Enregistrer</button>
      </form>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}

void (0 as unknown as SettingKey);
