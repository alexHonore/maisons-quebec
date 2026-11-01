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
    .prepare("SELECT path, occurred_at, visitor_id FROM page_views WHERE occurred_at >= ? AND occurred_at < ?")
    .all(bounds.startIso, bounds.endIso)
    .map((row) => ({
      path: String(row.path),
      occurredAt: String(row.occurred_at),
      visitorId: row.visitor_id === null || row.visitor_id === undefined ? null : String(row.visitor_id),
    }));
  const sessions = db
    .prepare("SELECT started_at FROM visitor_sessions WHERE started_at >= ? AND started_at < ?")
    .all(bounds.startIso, bounds.endIso)
    .map((row) => ({ startedAt: String(row.started_at) }));
  const engagedSeconds = db
    .prepare("SELECT seconds, occurred_at FROM engaged_seconds WHERE occurred_at >= ? AND occurred_at < ?")
    .all(bounds.startIso, bounds.endIso)
    .map((row) => ({ seconds: Number(row.seconds), occurredAt: String(row.occurred_at) }));
  const leads = db
    .prepare("SELECT funnel_name, created_at FROM leads WHERE created_at >= ? AND created_at < ?")
    .all(bounds.startIso, bounds.endIso)
    .map((row) => ({ funnelName: String(row.funnel_name), createdAt: String(row.created_at) }));
  return buildAnalyticsReport({ from: input.from, to: input.to, pageViews, sessions, engagedSeconds, leads });
}

export function canReadAnalytics(role: AdminRole): boolean {
  return roleCan(role, "analytics.read");
}
