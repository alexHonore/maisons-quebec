import { DatabaseSync } from "node:sqlite";
import type { AdminRole } from "./admin-access";
import { roleCan } from "./admin-permissions";
import { buildAnalyticsReport, periodBounds, type AnalyticsReport } from "../domain/analytics-report";

export function loadAnalyticsReport(
  db: DatabaseSync,
  input: { from: string; to: string },
): AnalyticsReport | null {
  const bounds = periodBounds(input.from, input.to);
  if (!bounds) return null;
  const pageViews = db
    .prepare("SELECT path, occurred_at FROM page_views WHERE occurred_at >= ? AND occurred_at < ?")
    .all(bounds.startIso, bounds.endIso)
    .map((row) => ({ path: String(row.path), occurredAt: String(row.occurred_at) }));
  const leads = db
    .prepare("SELECT funnel_name, created_at FROM leads WHERE created_at >= ? AND created_at < ?")
    .all(bounds.startIso, bounds.endIso)
    .map((row) => ({ funnelName: String(row.funnel_name), createdAt: String(row.created_at) }));
  return buildAnalyticsReport({ from: input.from, to: input.to, pageViews, leads });
}

export function canReadAnalytics(role: AdminRole): boolean {
  return roleCan(role, "analytics.read");
}
