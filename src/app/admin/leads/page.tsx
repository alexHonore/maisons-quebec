import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { deliveryLabel, leadVisibility, listLeadAggregates, listLeadsForOwner } from "@/server/acquisition";
import { readLiveAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Demandes",
  robots: { index: false, follow: false },
};

export default async function LeadsPage() {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  const visibility = leadVisibility(live.user.role);
  if (visibility === "none") forbidden();
  const db = settingsDatabase(process.env);
  const full = visibility === "full" ? listLeadsForOwner(db) : null;
  const aggregate = full ? null : listLeadAggregates(db);
  const count = full ? full.length : aggregate!.length;

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Demandes</h1>
      <p>
        {full
          ? "Les coordonnées sont visibles pour le propriétaire seulement."
          : "Cette vue indique le nombre et l'état. Elle ne montre ni nom ni courriel."}
      </p>
      <p>{count === 0 ? "Aucune demande enregistrée." : `${count} demande${count > 1 ? "s" : ""}.`}</p>
      <ul className="plain-list">
        {full
          ? full.map((row) => (
              <li key={row.id}>
                {row.createdAt} — {deliveryLabel(row.deliveryStatus)} — {row.name} — {row.email}
              </li>
            ))
          : aggregate!.map((row) => (
              <li key={row.id}>
                {row.createdAt} — {deliveryLabel(row.deliveryStatus)}
              </li>
            ))}
      </ul>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
