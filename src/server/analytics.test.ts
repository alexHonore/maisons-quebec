import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DatabaseSync } from "node:sqlite";
import {
  renderAnalyticsCsv,
  renderAnalyticsJson,
  renderAnalyticsPdf,
  signatureFromCsv,
  signatureFromJson,
  signatureFromPdf,
  totalsSignature,
} from "../domain/analytics-report";
import { ADMIN_ROLES } from "./admin-access";
import { canReadAnalytics, loadAnalyticsReport } from "./analytics";
import { saveNetProceedsDraft, captureLead } from "./acquisition";
import { recordPageView } from "./page-views";
import { migrateUp } from "./settings-db";

const input = {
  salePriceCents: 50_000_000,
  mortgageBalanceCents: 0,
  brokerage: { kind: "fixed" as const, amountCents: 0 },
  taxesOnBrokerage: [],
  mortgagePenaltyCents: null,
  legalFeesCents: 0,
  otherExpensesCents: 0,
};

describe("collecte analytique", () => {
  it("compte seulement les vues et les leads de la période, sans courriel", () => {
    const db = new DatabaseSync(":memory:");
    migrateUp(db);
    assert.equal(recordPageView(db, "/admin/leads", new Date("2026-07-15T12:00:00.000Z")), false);
    assert.equal(recordPageView(db, "/vendre?email=personne@example.com", new Date("2026-07-15T16:00:00.000Z")), true);
    assert.equal(recordPageView(db, "/", new Date("2026-07-15T16:30:00.000Z")), true);
    assert.equal(recordPageView(db, "/", new Date("2026-07-14T16:30:00.000Z")), true);
    const draftId = saveNetProceedsDraft(db, input, new Date("2026-07-15T17:00:00.000Z"));
    const saved = captureLead(db, {
      name: "Personne Test",
      email: "personne@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId,
    }, new Date("2026-07-15T17:00:00.000Z"));
    assert.equal(saved.ok, true);
    const outside = saveNetProceedsDraft(db, input, new Date("2026-06-01T17:00:00.000Z"));
    captureLead(db, {
      name: "Autre Personne",
      email: "autre@example.com",
      consentToRespond: true,
      consentMarketing: false,
      draftId: outside,
    }, new Date("2026-06-01T17:00:00.000Z"));

    const report = loadAnalyticsReport(db, { from: "2026-07-15", to: "2026-07-15" });
    assert.ok(report);
    if (!report) return;
    assert.deepEqual(report.pageViews, { state: "observe", count: 2 });
    assert.deepEqual(report.leads, { state: "observe", count: 1 });
    assert.equal(report.pages.state === "observe" && report.pages.rows.some((row) => row.path === "/vendre" && row.views === 1), true);
    const signature = totalsSignature(report);
    const json = renderAnalyticsJson(report);
    const csv = renderAnalyticsCsv(report);
    const pdf = renderAnalyticsPdf(report);
    assert.equal(signatureFromJson(json), signature);
    assert.equal(signatureFromCsv(csv), signature);
    assert.equal(signatureFromPdf(pdf), signature);
    assert.equal(`${json}${csv}${pdf}`.includes("personne@example.com"), false);
    assert.equal(`${json}${csv}${pdf}`.includes("autre@example.com"), false);

    const hole = loadAnalyticsReport(db, { from: "2026-08-01", to: "2026-08-02" });
    assert.equal(hole?.pageViews.state, "trou");
    assert.equal(hole?.leads.state, "trou");
    assert.equal(hole ? totalsSignature(hole).includes(" 0") : false, false);
    assert.deepEqual(ADMIN_ROLES.filter((role) => canReadAnalytics(role)), ["owner", "analyst"]);
    db.close();
  });
});
