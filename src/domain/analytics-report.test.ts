import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAnalyticsReport,
  chartBarLength,
  chartTotalsFromCsv,
  chartTotalsFromJson,
  exportSignature,
  periodBounds,
  readChart,
  renderAnalyticsCsv,
  renderAnalyticsJson,
  renderAnalyticsPdf,
  reportDeltas,
  signatureFromCsv,
  signatureFromJson,
  signatureFromPdf,
  torontoDayStartUtc,
  totalsSignature,
  totalDelta,
  type AnalyticsReport,
} from "./analytics-report";

function assertChartMatchesExports(report: AnalyticsReport): void {
  const json = renderAnalyticsJson(report);
  const csv = renderAnalyticsCsv(report);
  const pdf = renderAnalyticsPdf(report);
  const chart = readChart(pdf);
  const totals = chart.map(({ name, state, count }) => ({ name, state, count }));
  assert.deepEqual(totals, chartTotalsFromJson(json));
  assert.deepEqual(totals, chartTotalsFromCsv(csv));
  const max = chart.reduce((highest, item) => item.count === null ? highest : Math.max(highest, item.count), 0);
  for (const item of chart) {
    if (item.state === "trou") {
      assert.equal(item.bar, null);
      assert.equal(item.count, null);
    } else {
      assert.equal(item.bar, chartBarLength(item.count ?? 0, max));
    }
  }
}

describe("rapport d'analytique", () => {
  it("borne les journées au fuseau de Toronto", () => {
    assert.equal(torontoDayStartUtc("2026-07-15")?.toISOString(), "2026-07-15T04:00:00.000Z");
    assert.equal(torontoDayStartUtc("2026-01-15")?.toISOString(), "2026-01-15T05:00:00.000Z");
    const bounds = periodBounds("2026-07-15", "2026-07-15");
    assert.equal(bounds?.startIso, "2026-07-15T04:00:00.000Z");
    assert.equal(bounds?.endIso, "2026-07-16T04:00:00.000Z");
  });

  it("montre un trou quand rien n'a eu lieu, et les mêmes totaux dans les trois exports", () => {
    const empty = buildAnalyticsReport({
      from: "2026-07-15",
      to: "2026-07-15",
      pageViews: [{ path: "/", occurredAt: "2026-07-15T03:00:00.000Z", visitorId: "11111111-1111-4111-8111-111111111111" }],
      sessions: [{ startedAt: "2026-07-15T03:00:00.000Z" }],
      engagedSeconds: [{ seconds: 7, occurredAt: "2026-07-15T03:00:00.000Z" }],
      leads: [{ funnelName: "produit_net", createdAt: "2026-07-16T05:00:00.000Z" }],
    });
    assert.ok(empty);
    if (!empty) return;
    assert.equal(empty.pageViews.state, "trou");
    assert.equal(empty.sessions.state, "trou");
    assert.equal(empty.uniqueVisitors.state, "trou");
    assert.equal(empty.engagedSeconds.state, "trou");
    assert.equal(empty.returns.state, "trou");
    assert.equal(empty.leads.state, "trou");
    assert.equal("count" in empty.pageViews, false);
    assert.equal(empty.pages.state, "trou");
    assert.equal(empty.conversions.state, "trou");
    const signature = totalsSignature(empty);
    assert.equal(signature.includes(" 0"), false);
    const emptyPdf = renderAnalyticsPdf(empty);
    assert.equal(signatureFromJson(renderAnalyticsJson(empty)), signature);
    assert.equal(signatureFromCsv(renderAnalyticsCsv(empty)), signature);
    assert.equal(signatureFromPdf(emptyPdf), signature);
    assertChartMatchesExports(empty);
    assert.equal(emptyPdf.includes(" 10 re"), false);

    const observed = buildAnalyticsReport({
      from: "2026-07-15",
      to: "2026-07-15",
      pageViews: [
        { path: "/", occurredAt: "2026-07-15T04:00:00.000Z", visitorId: "11111111-1111-4111-8111-111111111111" },
        { path: "/vendre", occurredAt: "2026-07-15T18:00:00.000Z", visitorId: "11111111-1111-4111-8111-111111111111" },
        { path: "/vendre", occurredAt: "2026-07-16T03:59:00.000Z", visitorId: "22222222-2222-4222-8222-222222222222" },
        { path: "/guides", occurredAt: "2026-07-15T12:00:00.000Z", visitorId: "personne@example.com" },
      ],
      sessions: [
        { startedAt: "2026-07-15T04:00:00.000Z" },
        { startedAt: "2026-07-14T12:00:00.000Z" },
      ],
      engagedSeconds: [],
      leads: [
        { funnelName: "produit_net", createdAt: "2026-07-15T15:00:00.000Z" },
        { funnelName: "produit_net", createdAt: "2026-07-14T15:00:00.000Z" },
      ],
    });
    assert.ok(observed);
    if (!observed) return;
    assert.deepEqual(observed.pageViews, { state: "observe", count: 4 });
    assert.deepEqual(observed.sessions, { state: "observe", count: 1 });
    assert.deepEqual(observed.uniqueVisitors, { state: "observe", count: 2 });
    assert.equal(observed.engagedSeconds.state, "trou");
    assert.deepEqual(observed.returns, { state: "observe", count: 0 });
    assert.deepEqual(observed.leads, { state: "observe", count: 1 });
    assert.equal(observed.pages.state === "observe" && observed.pages.rows.find((row) => row.path === "/vendre")?.views, 2);
    const observedSignature = totalsSignature(observed);
    const observedPdf = renderAnalyticsPdf(observed);
    assert.equal(signatureFromJson(renderAnalyticsJson(observed)), observedSignature);
    assert.equal(signatureFromCsv(renderAnalyticsCsv(observed)), observedSignature);
    assert.equal(signatureFromPdf(observedPdf), observedSignature);
    assertChartMatchesExports(observed);
    const observedChart = readChart(observedPdf);
    assert.equal(observedChart.find((item) => item.name === "returns")?.bar, 0);
    assert.equal(observedChart.find((item) => item.name === "engaged_seconds")?.bar, null);
    const packed = `${renderAnalyticsJson(observed)}\n${renderAnalyticsCsv(observed)}\n${renderAnalyticsPdf(observed)}`;
    assert.equal(packed.includes("personne@example.com"), false);
    assert.equal(observed.notCollected.includes("Search Console"), true);
    assert.equal(observed.notCollected.includes("rétention"), false);
    assert.equal(observed.notCollected.includes("temps engagé"), false);
    assert.equal(observed.notCollected.includes("sessions"), false);
  });

  it("compte un retour sur deux jours de Toronto et les secondes envoyées", () => {
    const visitor = "11111111-1111-4111-8111-111111111111";
    const report = buildAnalyticsReport({
      from: "2026-07-15",
      to: "2026-07-16",
      pageViews: [
        { path: "/", occurredAt: "2026-07-15T16:00:00.000Z", visitorId: visitor },
        { path: "/", occurredAt: "2026-07-16T16:00:00.000Z", visitorId: visitor },
      ],
      sessions: [],
      engagedSeconds: [
        { seconds: 7, occurredAt: "2026-07-15T16:00:00.000Z" },
        { seconds: 4, occurredAt: "2026-07-14T16:00:00.000Z" },
      ],
      leads: [],
    });
    assert.ok(report);
    if (!report) return;
    assert.deepEqual(report.returns, { state: "observe", count: 1 });
    assert.deepEqual(report.engagedSeconds, { state: "observe", count: 7 });
    const signature = totalsSignature(report);
    const pdf = renderAnalyticsPdf(report);
    assert.equal(signatureFromJson(renderAnalyticsJson(report)), signature);
    assert.equal(signatureFromCsv(renderAnalyticsCsv(report)), signature);
    assert.equal(signatureFromPdf(pdf), signature);
    assertChartMatchesExports(report);
    const chart = readChart(pdf);
    assert.equal(chart.find((item) => item.name === "engaged_seconds")?.count, 7);
    assert.equal(chart.find((item) => item.name === "returns")?.count, 1);
    assert.equal(chart.find((item) => item.name === "sessions")?.bar, null);
    assert.equal(chart.find((item) => item.name === "leads")?.bar, null);
  });

  it("n'affiche un écart que lorsque les deux périodes ont une mesure", () => {
    const visitor = "11111111-1111-4111-8111-111111111111";
    const chosen = buildAnalyticsReport({
      from: "2026-07-15",
      to: "2026-07-15",
      pageViews: [
        { path: "/", occurredAt: "2026-07-15T16:00:00.000Z", visitorId: visitor },
        { path: "/vendre", occurredAt: "2026-07-15T18:00:00.000Z", visitorId: visitor },
      ],
      sessions: [{ startedAt: "2026-07-15T16:00:00.000Z" }],
      engagedSeconds: [{ seconds: 7, occurredAt: "2026-07-15T16:00:00.000Z" }],
      leads: [{ funnelName: "produit_net", createdAt: "2026-07-15T17:00:00.000Z" }],
    });
    const baseline = buildAnalyticsReport({
      from: "2026-07-16",
      to: "2026-07-16",
      pageViews: [{ path: "/", occurredAt: "2026-07-16T16:00:00.000Z", visitorId: visitor }],
      sessions: [{ startedAt: "2026-07-16T16:00:00.000Z" }],
      engagedSeconds: [],
      leads: [],
    });
    const empty = buildAnalyticsReport({
      from: "2026-08-01",
      to: "2026-08-01",
      pageViews: [],
      sessions: [],
      engagedSeconds: [],
      leads: [],
    });
    assert.ok(chosen && baseline && empty);
    if (!chosen || !baseline || !empty) return;
    assert.deepEqual(totalDelta({ state: "observe", count: 7 }, { state: "trou" }), { state: "trou" });
    assert.deepEqual(totalDelta({ state: "observe", count: 0 }, { state: "observe", count: 2 }), { state: "observe", count: -2 });
    const deltas = Object.fromEntries(reportDeltas(chosen, baseline).map((item) => [item.name, item.delta]));
    assert.deepEqual(deltas.page_views, { state: "observe", count: 1 });
    assert.deepEqual(deltas.sessions, { state: "observe", count: 0 });
    assert.deepEqual(deltas.unique_visitors, { state: "observe", count: 0 });
    assert.deepEqual(deltas.returns, { state: "observe", count: 0 });
    assert.deepEqual(deltas.engaged_seconds, { state: "trou" });
    assert.deepEqual(deltas.leads, { state: "trou" });
    const signature = exportSignature(chosen, baseline);
    assert.equal(signature.includes("ecart engaged_seconds observe"), false);
    assert.equal(signature.includes("ecart leads observe"), false);
    assert.equal(signature.includes("ecart sessions observe 0"), true);
    const json = renderAnalyticsJson(chosen, baseline);
    const csv = renderAnalyticsCsv(chosen, baseline);
    const pdf = renderAnalyticsPdf(chosen, baseline);
    assert.equal(signatureFromJson(json), signature);
    assert.equal(signatureFromCsv(csv), signature);
    assert.equal(signatureFromPdf(pdf), signature);
    assert.equal(json.includes("2026-07-16"), true);
    assert.equal(csv.includes("compare,page_views,observe,1"), true);
    assertChartMatchesExports(chosen);
    const chart = readChart(pdf);
    assert.equal(chart.length, 6);
    assert.equal(chart.find((item) => item.name === "engaged_seconds")?.bar === null, false);
    assert.equal((pdf.match(/10 re/g) ?? []).length, 6);
    const againstHole = exportSignature(chosen, empty);
    assert.equal(againstHole.includes("ecart page_views observe"), false);
    assert.equal(againstHole.includes("ecart engaged_seconds observe"), false);
    const bothHoles = exportSignature(empty, empty);
    assert.equal(bothHoles.includes(" 0"), false);
    assert.equal(signatureFromPdf(renderAnalyticsPdf(empty, empty)), bothHoles);
    assert.equal(signatureFromCsv(renderAnalyticsCsv(empty, empty)), bothHoles);
    assert.equal(signatureFromJson(renderAnalyticsJson(empty, empty)), bothHoles);
  });
});
