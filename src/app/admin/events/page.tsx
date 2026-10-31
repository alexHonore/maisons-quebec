import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { saveEventDefinitionAction, setEventDefinitionEnabledAction } from "@/app/admin/events/actions";
import { EVENT_FUNNELS, NATIVE_EVENTS, REFUSED_EVENT_TRIGGERS } from "@/domain/event-catalog";
import { listEventDefinitions, listEventTraces, nativeEventCounts } from "@/server/event-catalog";
import { readLiveAdmin } from "@/server/current-admin";
import { roleCan } from "@/server/admin-permissions";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Événements",
  robots: { index: false, follow: false },
};

const ERRORS: Record<string, string> = {
  invalid_name: "Le nom doit être un identifiant stable, distinct des événements natifs.",
  invalid_trigger: "Ce déclencheur n'est pas émis par le site.",
  invalid_version: "La version doit suivre le format 1.0.",
  invalid_funnel: "Ce funnel n'est pas ouvert.",
  consent_locked: "Une définition ne peut pas retirer le consentement.",
  duplicate_name: "Ce nom existe déjà. L'ancienne définition n'a pas été écrasée.",
  missing: "Définition introuvable.",
  forbidden: "Action refusée.",
};

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ enregistre?: string; erreur?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!roleCan(live.user.role, "events.read")) forbidden();
  const params = await searchParams;
  const db = settingsDatabase(process.env);
  const counts = nativeEventCounts(db);
  const definitions = listEventDefinitions(db);
  const traces = listEventTraces(db);
  const canManage = roleCan(live.user.role, "events.manage");

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Événements</h1>
      <p>
        Seuls les événements que le site écrit vraiment sont listés. Aucun script n&apos;est accepté. Une définition ne peut pas
        contourner le consentement, et le corps d&apos;un événement réel n&apos;est pas affiché ici.
      </p>
      {params.enregistre === "1" ? <p role="status">Définition enregistrée. Les événements déjà en file ne sont pas réécrits.</p> : null}
      {params.erreur ? <p role="alert">{ERRORS[params.erreur] ?? "Enregistrement refusé."}</p> : null}
      <h2>Émis par le site</h2>
      <ul className="plain-list">
        {NATIVE_EVENTS.map((event) => (
          <li key={event.eventType}>
            <p>
              {event.eventType} — schéma {event.schemaVersion} — {counts[event.eventType] === 0 ? "aucune émission observée" : `${counts[event.eventType]} émission${counts[event.eventType] > 1 ? "s" : ""} observée${counts[event.eventType] > 1 ? "s" : ""}`}
            </p>
            <p>{event.description}</p>
            <p>Déclencheur : {event.trigger}</p>
            <p>Consentement : {event.consentRule}</p>
            <p>Champs : {event.payloadFields.join(", ")}</p>
            <p>Exemple fictif</p>
            <pre>{JSON.stringify(event.fictionalExample, null, 2)}</pre>
          </li>
        ))}
      </ul>
      <h2>Refusés, parce qu&apos;ils ne sont pas émis</h2>
      <p>{REFUSED_EVENT_TRIGGERS.join(", ")}</p>
      <h2>Définitions</h2>
      {definitions.length === 0 ? <p>Aucune définition.</p> : null}
      <ul className="plain-list">
        {definitions.map((definition) => (
          <li key={definition.id}>
            <p>
              {definition.name} — {definition.trigger} — schéma {definition.schemaVersion} — {definition.funnelName ?? "tous les funnels ouverts"} — {definition.enabled ? "active" : "inactive"} — {definition.observedCount === 0 ? "aucune émission observée" : `${definition.observedCount} émission${definition.observedCount > 1 ? "s" : ""} observée${definition.observedCount > 1 ? "s" : ""}`}
            </p>
            {canManage ? (
              <form action={setEventDefinitionEnabledAction}>
                <input type="hidden" name="id" value={definition.id} />
                <input type="hidden" name="enabled" value={definition.enabled ? "0" : "1"} />
                <button className="button" type="submit">
                  {definition.enabled ? "Désactiver" : "Réactiver"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
      {canManage ? (
        <form className="form-grid" action={saveEventDefinitionAction}>
          <label>
            Nom stable
            <input name="name" required autoComplete="off" pattern="[a-z][a-z0-9_]{2,40}" />
          </label>
          <label>
            Déclencheur émis
            <select name="trigger" required defaultValue="lead.created">
              {NATIVE_EVENTS.map((event) => (
                <option key={event.eventType} value={event.eventType}>
                  {event.eventType}
                </option>
              ))}
            </select>
          </label>
          <label>
            Version de schéma
            <input name="schema_version" required defaultValue="1.0" autoComplete="off" />
          </label>
          <label>
            Funnel, facultatif
            <select name="funnel_name" defaultValue="">
              <option value="">Tous les funnels ouverts</option>
              {EVENT_FUNNELS.map((funnel) => (
                <option key={funnel} value={funnel}>
                  {funnel}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Enregistrer la définition</button>
        </form>
      ) : (
        <p>La lecture est permise. L&apos;enregistrement est réservé au propriétaire et au gestionnaire d&apos;intégrations.</p>
      )}
      <h2>Traces récentes, sans corps</h2>
      {traces.length === 0 ? <p>Aucune émission observée.</p> : null}
      <ul className="plain-list">
        {traces.map((trace) => (
          <li key={trace.id}>
            {trace.createdAt} — {trace.eventType} — {trace.status} — {trace.leadId}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
