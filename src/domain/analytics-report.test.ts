import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAnalyticsReport,
  periodBounds,
  renderAnalyticsCsv,
  renderAnalyticsJson,
  renderAnalyticsPdf,
  signatureFromCsv,
  signatureFromJson,
  signatureFromPdf,
  torontoDayStartUtc,
  totalsSignature,
} from "./analytics-report";

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
      pageViews: [{ path: "/", occurredAt: "2026-07-15T03:00:00.000Z" }],
      leads: [{ funnelName: "produit_net", createdAt: "2026-07-16T05:00:00.000Z" }],
    });
    assert.ok(empty);
    if (!empty) return;
    assert.equal(empty.pageViews.state, "trou");
    assert.equal(empty.leads.state, "trou");
    assert.equal("count" in empty.pageViews, false);
    assert.equal(empty.pages.state, "trou");
    assert.equal(empty.conversions.state, "trou");
    const signature = totalsSignature(empty);
    assert.equal(signature.includes(" 0"), false);
    assert.equal(signatureFromJson(renderAnalyticsJson(empty)), signature);
    assert.equal(signatureFromCsv(renderAnalyticsCsv(empty)), signature);
    assert.equal(signatureFromPdf(renderAnalyticsPdf(empty)), signature);

    const observed = buildAnalyticsReport({
      from: "2026-07-15",
      to: "2026-07-15",
      pageViews: [
        { path: "/", occurredAt: "2026-07-15T04:00:00.000Z" },
        { path: "/vendre", occurredAt: "2026-07-15T18:00:00.000Z" },
        { path: "/vendre", occurredAt: "2026-07-16T03:59:00.000Z" },
      ],
      leads: [
        { funnelName: "produit_net", createdAt: "2026-07-15T15:00:00.000Z" },
        { funnelName: "produit_net", createdAt: "2026-07-14T15:00:00.000Z" },
      ],
    });
    assert.ok(observed);
    if (!observed) return;
    assert.deepEqual(observed.pageViews, { state: "observe", count: 3 });
    assert.deepEqual(observed.leads, { state: "observe", count: 1 });
    assert.equal(observed.pages.state === "observe" && observed.pages.rows.find((row) => row.path === "/vendre")?.views, 2);
    const observedSignature = totalsSignature(observed);
    assert.equal(signatureFromJson(renderAnalyticsJson(observed)), observedSignature);
    assert.equal(signatureFromCsv(renderAnalyticsCsv(observed)), observedSignature);
    assert.equal(signatureFromPdf(renderAnalyticsPdf(observed)), observedSignature);
    const packed = `${renderAnalyticsJson(observed)}\n${renderAnalyticsCsv(observed)}\n${renderAnalyticsPdf(observed)}`;
    assert.equal(packed.includes("personne@example.com"), false);
    assert.equal(observed.notCollected.includes("rétention"), true);
    assert.equal(observed.notCollected.includes("Search Console"), true);
  });
});
