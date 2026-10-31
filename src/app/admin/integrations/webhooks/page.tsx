import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { saveWebhookDestinationAction } from "./actions";
import { listWebhookDestinations } from "@/server/acquisition";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Destinations",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid_url: "L'adresse doit être en HTTPS, sans identifiant dans l'URL.",
  invalid_secret: "Le secret est trop court. Rien n'a été enregistré.",
  key_missing: "Le secret de session est vide. La destination n'est pas enregistrée.",
  forbidden: "Action refusée.",
};

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; erreur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "webhooks.manage")) forbidden();
  const params = await searchParams;
  const destinations = listWebhookDestinations(settingsDatabase(process.env));

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Destinations de webhook</h1>
      <p>Sans destination active, une demande reste en attente. Elle n&apos;est pas marquée livrée. Le secret n&apos;est plus affiché après l&apos;enregistrement.</p>
      {params.enregistre === "1" ? <p role="status">Destination enregistrée.</p> : null}
      {params.erreur ? <p role="alert">{ERRORS[params.erreur] ?? "Enregistrement refusé."}</p> : null}
      {destinations.length === 0 ? (
        <p>Aucune destination.</p>
      ) : (
        <ul className="plain-list">
          {destinations.map((destination) => (
            <li key={destination.id}>
              {destination.name} — {destination.url} — {destination.enabled ? "active" : "inactive"} — secret enregistré
            </li>
          ))}
        </ul>
      )}
      <form className="form-grid" action={saveWebhookDestinationAction}>
        <label>
          Nom
          <input name="name" required autoComplete="off" />
        </label>
        <label>
          URL HTTPS
          <input name="url" type="url" required autoComplete="off" />
        </label>
        <label>
          Secret de signature
          <input name="secret" type="password" required autoComplete="new-password" />
        </label>
        <button type="submit">Enregistrer la destination</button>
      </form>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
