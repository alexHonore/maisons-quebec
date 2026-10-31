import type { Metadata } from "next";
import Link from "next/link";
import { unauthorized } from "next/navigation";
import { saveSiteSettingsAction } from "./actions";
import { REGULATORY_EMPTY_LABEL } from "@/domain/regulatory-identity";
import { readCurrentAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";
import { readStoredSettings } from "@/server/settings-db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Réglages",
  robots: { index: false, follow: false },
};

const FIELDS = [
  ["brand_name", "Nom de marque", false],
  ["hero_title", "Titre d'accueil", true],
  ["hero_promise", "Promesse", true],
  ["hero_subpromise", "Sous-promesse", true],
  ["broker_oaciq_permit", "Permis OACIQ du courtier", false],
  ["agency_name", "Nom de l'agence", false],
  ["agency_permit", "Permis de l'agence", false],
] as const;

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; erreur?: string }>;
}) {
  const decision = await readCurrentAdmin();
  if (!decision.allowed) unauthorized();
  const params = await searchParams;
  const stored = readStoredSettings(settingsDatabase(process.env));

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Réglages du site</h1>
      <p>Ces valeurs sont enregistrées dans la base locale. Un champ réglementaire vide reste vide.</p>
      {params.enregistre === "1" ? <p role="status">Réglages enregistrés.</p> : null}
      {params.erreur === "1" ? <p role="alert">Les réglages n&apos;ont pas été enregistrés.</p> : null}
      <form className="form-grid" action={saveSiteSettingsAction}>
        {FIELDS.map(([key, label, long]) => (
          <label key={key}>
            {label}
            {long ? (
              <textarea name={key} rows={4} defaultValue={stored[key]} />
            ) : (
              <input
                name={key}
                defaultValue={stored[key]}
                placeholder={key.includes("permit") || key === "agency_name" ? REGULATORY_EMPTY_LABEL : undefined}
                autoComplete="off"
              />
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
