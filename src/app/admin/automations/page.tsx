import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { checkN8nAction, importAutomationAction, previewAutomationAction, saveAutomationAction, setAutomationEnabledAction } from "@/app/admin/automations/actions";
import {
  AUTOMATION_ACTION_LABELS,
  AUTOMATION_ACTIONS,
  AUTOMATION_RUN_LABELS,
  AUTOMATION_TRIGGERS,
  requestN8nConnection,
} from "@/domain/automation";
import { listAutomationRuns, listAutomations, listAutomationVersions, previewAutomation } from "@/server/automations";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Automatisations",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid_name: "Le nom doit être un identifiant stable, sans script.",
  invalid_trigger: "Ce déclencheur n'est pas émis par le site.",
  invalid_action: "Cette action n'est pas permise.",
  invalid_document: "Ce JSON n'est pas une automatisation de cette tranche.",
  secret_present: "Le JSON contient un secret, une adresse ou un courriel. Rien n'a été enregistré.",
  missing: "Automatisation introuvable.",
  forbidden: "Action refusée.",
};

export default async function AutomationsPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; erreur?: string; n8n?: string; essai?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "automations.manage")) forbidden();
  const params = await searchParams;
  const db = settingsDatabase(process.env);
  const automations = listAutomations(db);
  const versions = listAutomationVersions(db);
  const runs = listAutomationRuns(db);
  const n8n = requestN8nConnection({ baseUrl: process.env.N8N_BASE_URL });
  const preview = params.essai ? previewAutomation(db, { actorRole: live.user.role, id: params.essai }) : null;

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Automatisations</h1>
      <p>
        Déclencheurs limités aux événements déjà émis. Actions de cette tranche : remettre une livraison webhook en file, ou
        écrire une tâche admin sans donnée personnelle. Pas de publication automatique.
      </p>
      <h2>n8n</h2>
      {n8n.message === "à connecter" ? (
        <p>À connecter. Aucun appel n&apos;est fait.</p>
      ) : (
        <p>Non branché. L&apos;adresse est lue, aucun appel n&apos;est fait.</p>
      )}
      {params.n8n === "a-connecter" ? <p role="status">À connecter. Aucun appel n&apos;a été fait.</p> : null}
      {params.n8n === "non-branche" ? <p role="status">Non branché. Aucun appel n&apos;a été fait.</p> : null}
      <form action={checkN8nAction}>
        <button className="button" type="submit">
          Vérifier n8n
        </button>
      </form>
      {params.enregistre === "1" ? <p role="status">Automatisation enregistrée. Les versions précédentes restent en place.</p> : null}
      {params.erreur ? <p role="alert">{ERRORS[params.erreur] ?? "Enregistrement refusé."}</p> : null}
      {preview?.ok ? <p role="status">{preview.summary}</p> : null}
      <h2>Définitions</h2>
      {automations.length === 0 ? <p>Aucune automatisation.</p> : null}
      <ul className="plain-list">
        {automations.map((automation) => (
          <li key={automation.id}>
            <p>
              {automation.name} — version {automation.versionNumber} — {automation.trigger} — {AUTOMATION_ACTION_LABELS[automation.action]} — {automation.enabled ? "active" : "inactive"}
            </p>
            <ul>
              {versions
                .filter((version) => version.automationId === automation.id)
                .map((version) => (
                  <li key={`${version.automationId}-${version.versionNumber}`}>
                    Version {version.versionNumber} — {version.trigger} — {version.action}
                  </li>
                ))}
            </ul>
            <p>
              <a href={`/admin/automations/export?id=${automation.id}`}>Exporter JSON</a>
            </p>
            <form action={previewAutomationAction}>
              <input type="hidden" name="id" value={automation.id} />
              <button className="button" type="submit">
                Essai à blanc
              </button>
            </form>
            <form action={setAutomationEnabledAction}>
              <input type="hidden" name="id" value={automation.id} />
              <input type="hidden" name="enabled" value={automation.enabled ? "0" : "1"} />
              <button className="button" type="submit">
                {automation.enabled ? "Désactiver" : "Réactiver"}
              </button>
            </form>
            <form className="form-grid" action={saveAutomationAction}>
              <input type="hidden" name="name" value={automation.name} />
              <label>
                Déclencheur
                <select name="trigger" required defaultValue={automation.trigger}>
                  {AUTOMATION_TRIGGERS.map((trigger) => (
                    <option key={trigger} value={trigger}>
                      {trigger}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Action
                <select name="action" required defaultValue={automation.action}>
                  {AUTOMATION_ACTIONS.map((action) => (
                    <option key={action} value={action}>
                      {AUTOMATION_ACTION_LABELS[action]}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit">Enregistrer une nouvelle version</button>
            </form>
          </li>
        ))}
      </ul>
      <h2>Nouvelle automatisation</h2>
      <form className="form-grid" action={saveAutomationAction}>
        <label>
          Nom stable
          <input name="name" required autoComplete="off" pattern="[a-z][a-z0-9_]{2,40}" />
        </label>
        <label>
          Déclencheur émis
          <select name="trigger" required defaultValue="lead.created">
            {AUTOMATION_TRIGGERS.map((trigger) => (
              <option key={trigger} value={trigger}>
                {trigger}
              </option>
            ))}
          </select>
        </label>
        <label>
          Action
          <select name="action" required defaultValue="webhook.requeue">
            {AUTOMATION_ACTIONS.map((action) => (
              <option key={action} value={action}>
                {AUTOMATION_ACTION_LABELS[action]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Enregistrer</button>
      </form>
      <h2>Importer un JSON</h2>
      <p>Le fichier accepté contient le nom, le déclencheur et l&apos;action. Un secret, une adresse ou un courriel est refusé. L&apos;import ajoute une version.</p>
      <form className="form-grid" action={importAutomationAction}>
        <label>
          JSON
          <textarea name="document" required rows={6} maxLength={4000} />
        </label>
        <button type="submit">Importer</button>
      </form>
      <h2>Exécutions</h2>
      <p>Une absence de destination reste « aucune destination ». Ce n&apos;est pas une livraison.</p>
      {runs.length === 0 ? <p>Aucune exécution observée.</p> : null}
      <ul className="plain-list">
        {runs.map((run, index) => (
          <li key={`${run.createdAt}-${run.trigger}-${index}`}>
            {run.createdAt} — {run.trigger} — {run.action} — {AUTOMATION_RUN_LABELS[run.state]}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
