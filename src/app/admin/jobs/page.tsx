import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { runSettingsPresenceJobAction } from "./actions";
import { ADMIN_ROLE_LABELS } from "@/server/admin-access";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { listJobRuns } from "@/server/job-journal";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contrôles",
  robots: { index: false, follow: false },
};

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "jobs.read")) forbidden();
  const params = await searchParams;
  const runs = listJobRuns(settingsDatabase(process.env));

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Journal des contrôles</h1>
      <p>Ce journal ne contient ni courriel, ni permis, ni statistique de marché. Il note seulement si des champs de réglage sont vides ou renseignés.</p>
      {params.enregistre === "1" ? <p role="status">Contrôle enregistré.</p> : null}
      {roleCan(live.user.role, "jobs.run_demo") ? (
        <form action={runSettingsPresenceJobAction}>
          <button className="button" type="submit">
            Lancer le contrôle des réglages
          </button>
        </form>
      ) : (
        <p>Ce rôle peut lire le journal, pas lancer le contrôle.</p>
      )}
      {runs.length === 0 ? (
        <p>Aucun contrôle n&apos;a été lancé.</p>
      ) : (
        <ul className="plain-list">
          {runs.map((run) => (
            <li key={run.id}>
              {run.jobName} — {run.status} — rôle {ADMIN_ROLE_LABELS[run.actorRole]} — {run.summary}
            </li>
          ))}
        </ul>
      )}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
