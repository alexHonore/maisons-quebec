import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { NOT_COLLECTED } from "@/domain/analytics-report";
import { canReadAnalytics, loadAnalyticsReport } from "@/server/analytics";
import { readLiveAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytique",
  robots: { index: false, follow: false },
};

function measureText(measure: { state: "observe"; count: number } | { state: "trou" }): string {
  return measure.state === "observe" ? String(measure.count) : "Trou — aucun événement enregistré. Ce n'est pas un zéro mesuré.";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!canReadAnalytics(live.user.role)) forbidden();
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";
  const report = from !== "" && to !== "" ? loadAnalyticsReport(settingsDatabase(process.env), { from, to }) : null;

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Analytique</h1>
      <p>
        Une session démarre à une vue de page publique. Un visiteur unique est un identifiant distinct sur la période. Le temps engagé est la somme des secondes envoyées pendant que l&apos;onglet est visible. Un retour est le même identifiant vu sur deux jours civils de Toronto.
      </p>
      <ul className="plain-list">
        {NOT_COLLECTED.map((item) => (
          <li key={item}>{item} — trou</li>
        ))}
      </ul>
      <form className="form-grid" method="get">
        <label>
          Du
          <input name="from" type="date" required defaultValue={from} />
        </label>
        <label>
          Au
          <input name="to" type="date" required defaultValue={to} />
        </label>
        <button type="submit">Voir la période</button>
      </form>
      {from !== "" && to !== "" && !report ? <p role="alert">Période inutilisable.</p> : null}
      {report ? (
        <>
          <p>Période {report.from} au {report.to}, fuseau {report.timezone}.</p>
          <p>Vues de pages : {measureText(report.pageViews)}</p>
          <p>Sessions : {measureText(report.sessions)}</p>
          <p>Visiteurs uniques : {measureText(report.uniqueVisitors)}</p>
          <p>Temps engagé : {report.engagedSeconds.state === "observe" ? `${report.engagedSeconds.count} s` : "Trou — aucun signal de secondes visibles. Ce n'est pas un zéro mesuré."}</p>
          <p>Retours : {report.returns.state === "trou" ? "Trou — aucune visite. Ce n'est pas un zéro mesuré." : report.returns.count === 0 ? "0 — des visites, aucun identifiant revu un autre jour." : String(report.returns.count)}</p>
          <p>Demandes : {measureText(report.leads)}</p>
          <h2>Pages</h2>
          {report.pages.state === "trou" ? (
            <p>Trou — aucune vue enregistrée dans cette période.</p>
          ) : (
            <ul className="plain-list">
              {report.pages.rows.map((row) => (
                <li key={row.path}>
                  {row.path} — {row.views}
                </li>
              ))}
            </ul>
          )}
          <h2>Conversions</h2>
          <p>Le taux par page est un trou : une demande n&apos;enregistre pas la page d&apos;origine.</p>
          {report.conversions.state === "trou" ? (
            <p>Trou — aucune demande enregistrée dans cette période.</p>
          ) : (
            <ul className="plain-list">
              {report.conversions.rows.map((row) => (
                <li key={row.funnel}>
                  {row.funnel} — {row.leads}
                </li>
              ))}
            </ul>
          )}
          <p>
            <a href={`/admin/analytics/export?format=json&from=${report.from}&to=${report.to}`}>Exporter JSON</a>
            {" · "}
            <a href={`/admin/analytics/export?format=csv&from=${report.from}&to=${report.to}`}>Exporter CSV</a>
            {" · "}
            <a href={`/admin/analytics/export?format=pdf&from=${report.from}&to=${report.to}`}>Exporter PDF</a>
          </p>
        </>
      ) : null}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
