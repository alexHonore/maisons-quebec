import { readTrackingId } from "./visit-tracking";

export const ANALYTICS_TIME_ZONE = "America/Toronto";

export const NOT_COLLECTED = [
  "rétention",
  "temps engagé",
  "Search Console",
  "taux de conversion par page",
] as const;

export type ObservedCount = { readonly state: "observe"; readonly count: number };
export type Gap = { readonly state: "trou" };

export type PageViewRow = { readonly path: string; readonly views: number };
export type FunnelLeadRow = { readonly funnel: string; readonly leads: number };

export type AnalyticsReport = {
  readonly version: "1.0";
  readonly timezone: typeof ANALYTICS_TIME_ZONE;
  readonly from: string;
  readonly to: string;
  readonly pageViews: ObservedCount | Gap;
  readonly sessions: ObservedCount | Gap;
  readonly uniqueVisitors: ObservedCount | Gap;
  readonly leads: ObservedCount | Gap;
  readonly pages: { readonly state: "observe"; readonly rows: readonly PageViewRow[] } | Gap;
  readonly conversions: { readonly state: "observe"; readonly rows: readonly FunnelLeadRow[] } | Gap;
  readonly notCollected: readonly string[];
};

export function torontoDayStartUtc(isoDate: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return null;
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || month < 1 || month > 12 || !day || day < 1 || day > 31) return null;
  const noon = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  const noonDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(noon);
  if (noonDate !== isoDate) return null;
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  let utc = Date.UTC(year, month - 1, day, 5, 0, 0);
  for (let step = 0; step < 40; step += 1) {
    const parts = Object.fromEntries(fmt.formatToParts(new Date(utc)).map((part) => [part.type, part.value]));
    const got = `${parts.year}-${parts.month}-${parts.day}`;
    const hour = Number(parts.hour);
    const minute = Number(parts.minute);
    if (got === isoDate && hour === 0 && minute === 0) return new Date(utc);
    if (got < isoDate) utc += 60 * 60 * 1000;
    else if (got > isoDate) utc -= 60 * 60 * 1000;
    else utc -= (hour * 60 + minute) * 60 * 1000;
  }
  return null;
}

function nextCalendarDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  const monthText = String(next.getUTCMonth() + 1).padStart(2, "0");
  const dayText = String(next.getUTCDate()).padStart(2, "0");
  return `${next.getUTCFullYear()}-${monthText}-${dayText}`;
}

export function periodBounds(from: string, to: string): { startIso: string; endIso: string } | null {
  if (from > to) return null;
  const start = torontoDayStartUtc(from);
  const end = torontoDayStartUtc(nextCalendarDate(to));
  if (!start || !end) return null;
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

function inPeriod(iso: string, startIso: string, endIso: string): boolean {
  return iso >= startIso && iso < endIso;
}

function observedOrGap(count: number): ObservedCount | Gap {
  return count === 0 ? { state: "trou" } : { state: "observe", count };
}

export function buildAnalyticsReport(input: {
  readonly from: string;
  readonly to: string;
  readonly pageViews: readonly { readonly path: string; readonly occurredAt: string; readonly visitorId?: string | null }[];
  readonly sessions: readonly { readonly startedAt: string }[];
  readonly leads: readonly { readonly funnelName: string; readonly createdAt: string }[];
}): AnalyticsReport | null {
  const bounds = periodBounds(input.from, input.to);
  if (!bounds) return null;
  const views = input.pageViews.filter((row) => inPeriod(row.occurredAt, bounds.startIso, bounds.endIso));
  const sessions = input.sessions.filter((row) => inPeriod(row.startedAt, bounds.startIso, bounds.endIso));
  const visitors = new Set(
    views.map((row) => readTrackingId(row.visitorId)).filter((id): id is string => id !== null),
  );
  const leads = input.leads.filter((row) => inPeriod(row.createdAt, bounds.startIso, bounds.endIso));
  const pageCounts = new Map<string, number>();
  for (const view of views) pageCounts.set(view.path, (pageCounts.get(view.path) ?? 0) + 1);
  const funnelCounts = new Map<string, number>();
  for (const lead of leads) funnelCounts.set(lead.funnelName, (funnelCounts.get(lead.funnelName) ?? 0) + 1);
  const pageRows = [...pageCounts.entries()]
    .map(([path, count]) => ({ path, views: count }))
    .sort((a, b) => a.path.localeCompare(b.path));
  const funnelRows = [...funnelCounts.entries()]
    .map(([funnel, count]) => ({ funnel, leads: count }))
    .sort((a, b) => a.funnel.localeCompare(b.funnel));
  return {
    version: "1.0",
    timezone: ANALYTICS_TIME_ZONE,
    from: input.from,
    to: input.to,
    pageViews: observedOrGap(views.length),
    sessions: observedOrGap(sessions.length),
    uniqueVisitors: observedOrGap(visitors.size),
    leads: observedOrGap(leads.length),
    pages: pageRows.length === 0 ? { state: "trou" } : { state: "observe", rows: pageRows },
    conversions: funnelRows.length === 0 ? { state: "trou" } : { state: "observe", rows: funnelRows },
    notCollected: NOT_COLLECTED,
  };
}

export type TotalLine = { readonly kind: "total" | "page" | "funnel"; readonly name: string; readonly state: "observe" | "trou"; readonly count: number | null };

export function reportTotalLines(report: AnalyticsReport): TotalLine[] {
  const lines: TotalLine[] = [
    { kind: "total", name: "page_views", state: report.pageViews.state, count: report.pageViews.state === "observe" ? report.pageViews.count : null },
    { kind: "total", name: "sessions", state: report.sessions.state, count: report.sessions.state === "observe" ? report.sessions.count : null },
    { kind: "total", name: "unique_visitors", state: report.uniqueVisitors.state, count: report.uniqueVisitors.state === "observe" ? report.uniqueVisitors.count : null },
    { kind: "total", name: "leads", state: report.leads.state, count: report.leads.state === "observe" ? report.leads.count : null },
  ];
  if (report.pages.state === "observe") {
    for (const row of report.pages.rows) lines.push({ kind: "page", name: row.path, state: "observe", count: row.views });
  } else {
    lines.push({ kind: "page", name: "*", state: "trou", count: null });
  }
  if (report.conversions.state === "observe") {
    for (const row of report.conversions.rows) lines.push({ kind: "funnel", name: row.funnel, state: "observe", count: row.leads });
  } else {
    lines.push({ kind: "funnel", name: "*", state: "trou", count: null });
  }
  return lines;
}

export function totalsSignature(report: AnalyticsReport): string {
  return reportTotalLines(report)
    .map((line) => `${line.kind} ${line.name} ${line.state} ${line.count === null ? "trou" : String(line.count)}`)
    .join("\n");
}

export function renderAnalyticsJson(report: AnalyticsReport): string {
  return JSON.stringify({
    version: report.version,
    timezone: report.timezone,
    from: report.from,
    to: report.to,
    totals: {
      page_views: report.pageViews,
      sessions: report.sessions,
      unique_visitors: report.uniqueVisitors,
      leads: report.leads,
    },
    pages: report.pages,
    conversions: report.conversions,
    not_collected: report.notCollected,
    signature: totalsSignature(report),
  });
}

export function renderAnalyticsCsv(report: AnalyticsReport): string {
  const rows = ["kind,name,state,count"];
  for (const line of reportTotalLines(report)) {
    rows.push(`${line.kind},${line.name},${line.state},${line.count === null ? "" : String(line.count)}`);
  }
  return `${rows.join("\n")}\n`;
}

function pdfEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export function renderAnalyticsPdf(report: AnalyticsReport): string {
  const lines = [
    "Maisons Quebec",
    `periode ${report.from} ${report.to}`,
    "fuseau America/Toronto",
    ...totalsSignature(report).split("\n"),
    "non collecte retention temps engage Search Console taux par page",
  ];
  const commands = ["BT", "/F1 11 Tf", "72 740 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -16 Td");
    commands.push(`(${pdfEscape(line)}) Tj`);
  });
  commands.push("ET");
  const stream = commands.join("\n");
  const objects = [
    "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n",
    "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n",
    "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj\n",
    `4 0 obj << /Length ${stream.length} >> stream\n${stream}\nendstream\nendobj\n`,
    "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj\n",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(pdf.length);
    pdf += object;
  }
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

function parseLine(kind: string, name: string, state: string, countText: string): string {
  const count = state === "trou" || countText === "" ? "trou" : countText;
  return `${kind} ${name} ${state} ${count}`;
}

export function signatureFromJson(json: string): string {
  const parsed = JSON.parse(json) as { signature?: string };
  if (!parsed.signature) throw new Error("Signature absente.");
  return parsed.signature;
}

export function signatureFromCsv(csv: string): string {
  const [header, ...rows] = csv.trim().split("\n");
  if (header !== "kind,name,state,count") throw new Error("CSV inattendu.");
  return rows.map((row) => {
    const [kind, name, state, count] = row.split(",");
    return parseLine(kind ?? "", name ?? "", state ?? "", count ?? "");
  }).join("\n");
}

export function signatureFromPdf(pdf: string): string {
  const matches = [...pdf.matchAll(/\(([^)]*)\) Tj/g)].map((match) => match[1] ?? "");
  return matches.filter((line) => /^(total|page|funnel) /.test(line)).join("\n");
}
