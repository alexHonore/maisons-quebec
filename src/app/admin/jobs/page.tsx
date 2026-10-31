import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { enqueueSettingsJobAction, executeQueueAction, retryQueueJobAction } from "./actions";
import { ADMIN_ROLE_LABELS } from "@/server/admin-access";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { listJobRuns } from "@/server/job-journal";
import { listQueueJobs } from "@/server/job-queue";
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
  const db = settingsDatabase(process.env);
  const runs = listJobRuns(db);
  const queue = listQueueJobs(db);
  const canRun = roleCan(live.user.role, "jobs.run_demo");

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Journal des contrôles</h1>
      <p>Ce journal ne contient ni courriel, ni permis, ni statistique de marché. Il note seulement si des champs de réglage sont vides ou renseignés.</p>
      {params.enregistre === "1" ? <p role="status">File mise à jour.</p> : null}
      {canRun ? (
        <div className="nav">
          <form action={enqueueSettingsJobAction}>
            <button className="button" type="submit">
              Enfiler le contrôle
            </button>
          </form>
          <form action={executeQueueAction}>
            <button className="button" type="submit">
              Exécuter la prochaine tâche
            </button>
          </form>
        </div>
      ) : (
        <p>Ce rôle peut lire le journal, pas lancer le contrôle.</p>
      )}
      <h2>File</h2>
      {queue.length === 0 ? (
        <p>Aucune tâche dans la file.</p>
      ) : (
        <ul className="plain-list">
          {queue.map((job) => (
            <li key={job.id}>
              {job.jobName} — {job.status} — essai {job.attempts}/{job.maxAttempts}
              {job.lastError ? ` — ${job.lastError}` : ""} — rôle {ADMIN_ROLE_LABELS[job.actorRole]}
              {canRun && job.status === "failed" && job.attempts < job.maxAttempts ? (
                <form action={retryQueueJobAction}>
                  <input type="hidden" name="id" value={job.id} />
                  <button className="button" type="submit">
                    Reprendre
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
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
