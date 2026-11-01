import type { Metadata } from "next";
import Link from "next/link";
import { forbidden, unauthorized } from "next/navigation";
import { NOT_COLLECTED, pageRateDeltas, reportDeltas, type MeasureName, type PageRate } from "@/domain/analytics-report";
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

const TOTALS: { readonly name: MeasureName; readonly label: string }[] = [
  { name: "page_views", label: "Vues de pages" },
  { name: "sessions", label: "Sessions" },
  { name: "unique_visitors", label: "Visiteurs uniques" },
  { name: "engaged_seconds", label: "Temps engagé" },
  { name: "returns", label: "Retours" },
  { name: "leads", label: "Demandes" },
];

function countLabel(name: MeasureName, measure: { state: "observe"; count: number } | { state: "trou" }): string {
  if (name === "engaged_seconds") {
    return measure.state === "observe" ? `${measure.count} s` : "Trou — aucun signal de secondes visibles. Ce n'est pas un zéro mesuré.";
  }
  if (name === "returns") {
    if (measure.state === "trou") return "Trou — aucune visite. Ce n'est pas un zéro mesuré.";
    return measure.count === 0 ? "0 — des visites, aucun identifiant revu un autre jour." : String(measure.count);
  }
  return measureText(measure);
}

function deltaText(delta: { state: "observe"; count: number } | { state: "trou" }): string {
  return delta.state === "observe" ? String(delta.count) : "Trou — une des deux périodes n'a pas de mesure. Ce n'est pas un écart depuis zéro.";
}

function rateText(row: PageRate): string {
  return row.rate.state === "observe" ? row.rate.text : "Trou — aucune vue mesurée de ce chemin. Ce n'est pas une division par zéro.";
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; compare_from?: string; compare_to?: string }>;
}) {
  const live = await readLiveAdmin();
  if (!live.ok) unauthorized();
  if (!canReadAnalytics(live.user.role)) forbidden();
  const params = await searchParams;
  const from = params.from ?? "";
  const to = params.to ?? "";
  const compareFrom = params.compare_from ?? "";
  const compareTo = params.compare_to ?? "";
  const db = settingsDatabase(process.env);
  const report = from !== "" && to !== "" ? loadAnalyticsReport(db, { from, to }) : null;
  const comparisonAsked = compareFrom !== "" || compareTo !== "";
  const comparison = compareFrom !== "" && compareTo !== "" ? loadAnalyticsReport(db, { from: compareFrom, to: compareTo }) : null;

  return (
    <main className="wrap sheet" id="contenu" style={{ marginBlock: "2rem" }}>
      <h1>Analytique</h1>
      <p>
        Une session démarre à une vue de page publique. Un visiteur unique est un identifiant distinct sur la période. Le temps engagé est la somme des secondes envoyées pendant que l&apos;onglet est visible. Un retour est le même identifiant vu sur deux jours civils de Toronto. L&apos;écart est la période choisie moins la période comparée, seulement si les deux ont une mesure.
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
        <label>
          Comparer du
          <input name="compare_from" type="date" defaultValue={compareFrom} />
        </label>
        <label>
          Comparer au
          <input name="compare_to" type="date" defaultValue={compareTo} />
        </label>
        <button type="submit">Voir les périodes</button>
      </form>
      {from !== "" && to !== "" && !report ? <p role="alert">Période inutilisable.</p> : null}
      {comparisonAsked && !comparison ? <p role="alert">Période de comparaison inutilisable.</p> : null}
      {report ? (
        <>
          <p>Période {report.from} au {report.to}, fuseau {report.timezone}.</p>
          <p>Vues de pages : {measureText(report.pageViews)}</p>
          <p>Sessions : {measureText(report.sessions)}</p>
          <p>Visiteurs uniques : {measureText(report.uniqueVisitors)}</p>
          <p>Temps engagé : {report.engagedSeconds.state === "observe" ? `${report.engagedSeconds.count} s` : "Trou — aucun signal de secondes visibles. Ce n'est pas un zéro mesuré."}</p>
          <p>Retours : {report.returns.state === "trou" ? "Trou — aucune visite. Ce n'est pas un zéro mesuré." : report.returns.count === 0 ? "0 — des visites, aucun identifiant revu un autre jour." : String(report.returns.count)}</p>
          <p>Demandes : {measureText(report.leads)}</p>
          {comparison ? (
            <>
              <h2>Période comparée</h2>
              <p>Période {comparison.from} au {comparison.to}.</p>
              <p>Vues de pages : {measureText(comparison.pageViews)}</p>
              <p>Sessions : {measureText(comparison.sessions)}</p>
              <p>Visiteurs uniques : {measureText(comparison.uniqueVisitors)}</p>
              <p>Temps engagé : {countLabel("engaged_seconds", comparison.engagedSeconds)}</p>
              <p>Retours : {countLabel("returns", comparison.returns)}</p>
              <p>Demandes : {measureText(comparison.leads)}</p>
              {comparison.pageRates.length === 0 ? (
                <p>Taux : trou — aucun parcours connu sur cette période.</p>
              ) : (
                <ul className="plain-list">
                  {comparison.pageRates.map((row) => (
                    <li key={row.path}>
                      Taux {row.path} — {rateText(row)}
                    </li>
                  ))}
                </ul>
              )}
              <h2>Écarts</h2>
              <p>Période choisie moins période comparée.</p>
              <ul className="plain-list">
                {reportDeltas(report, comparison).map((item) => (
                  <li key={item.name}>
                    {TOTALS.find((total) => total.name === item.name)?.label} : {deltaText(item.delta)}
                  </li>
                ))}
                {pageRateDeltas(report, comparison).map((item) => (
                  <li key={item.path}>
                    Taux {item.path} : {item.delta.state === "observe" ? item.delta.text : "Trou — une des deux périodes n'a pas de taux mesuré. Ce n'est pas un écart depuis zéro."}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
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
          <h2>Taux par page</h2>
          <p>Le taux est les demandes d&apos;un parcours divisées par les vues de son chemin connu. Une page sans parcours n&apos;a pas de taux.</p>
          {report.pageRates.length === 0 ? (
            <p>Trou — aucun parcours connu n&apos;a de vue ni de demande dans cette période.</p>
          ) : (
            <ul className="plain-list">
              {report.pageRates.map((row) => (
                <li key={row.path}>
                  {row.path} — {rateText(row)}
                </li>
              ))}
            </ul>
          )}
          <p>
            <a href={`/admin/analytics/export?format=json&from=${report.from}&to=${report.to}${comparison ? `&compare_from=${comparison.from}&compare_to=${comparison.to}` : ""}`}>Exporter JSON</a>
            {" · "}
            <a href={`/admin/analytics/export?format=csv&from=${report.from}&to=${report.to}${comparison ? `&compare_from=${comparison.from}&compare_to=${comparison.to}` : ""}`}>Exporter CSV</a>
            {" · "}
            <a href={`/admin/analytics/export?format=pdf&from=${report.from}&to=${report.to}${comparison ? `&compare_from=${comparison.from}&compare_to=${comparison.to}` : ""}`}>Exporter PDF</a>
            {" — le graphique ne dessine que les totaux mesurés."}
          </p>
        </>
      ) : null}
      <p>
        <Link href="/admin">Retour à l&apos;administration</Link>
      </p>
    </main>
  );
}
