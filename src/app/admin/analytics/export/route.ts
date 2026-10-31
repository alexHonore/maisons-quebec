import { renderAnalyticsCsv, renderAnalyticsJson, renderAnalyticsPdf } from "@/domain/analytics-report";
import { canReadAnalytics, loadAnalyticsReport } from "@/server/analytics";
import { readLiveAdmin } from "@/server/current-admin";
import { settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const live = await readLiveAdmin();
  if (!live.ok) return new Response("Non autorisé", { status: 401 });
  if (!canReadAnalytics(live.user.role)) return new Response("Interdit", { status: 403 });
  const url = new URL(request.url);
  const from = url.searchParams.get("from") ?? "";
  const to = url.searchParams.get("to") ?? "";
  const format = url.searchParams.get("format") ?? "";
  const report = loadAnalyticsReport(settingsDatabase(process.env), { from, to });
  if (!report) return new Response("Période inutilisable", { status: 400 });
  const filename = `analytique-${report.from}-${report.to}`;
  if (format === "json") {
    return new Response(renderAnalyticsJson(report), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.json"`,
        "cache-control": "private, no-store",
      },
    });
  }
  if (format === "csv") {
    return new Response(renderAnalyticsCsv(report), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${filename}.csv"`,
        "cache-control": "private, no-store",
      },
    });
  }
  if (format === "pdf") {
    return new Response(renderAnalyticsPdf(report), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${filename}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  }
  return new Response("Format inutilisable", { status: 400 });
}
