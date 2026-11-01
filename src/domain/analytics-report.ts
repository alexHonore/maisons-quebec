import { readTrackingId } from "./visit-tracking";

export const ANALYTICS_TIME_ZONE = "America/Toronto";

export const NOT_COLLECTED = ["Search Console", "taux de conversion par page"] as const;

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
  readonly engagedSeconds: ObservedCount | Gap;
  readonly returns: ObservedCount | Gap;
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

export function torontoCivilDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const formatted = new Intl.DateTimeFormat("en-CA", {
    timeZone: ANALYTICS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
  return /^\d{4}-\d{2}-\d{2}$/.test(formatted) ? formatted : null;
}

function observedOrGap(count: number): ObservedCount | Gap {
  return count === 0 ? { state: "trou" } : { state: "observe", count };
}

export function buildAnalyticsReport(input: {
  readonly from: string;
  readonly to: string;
  readonly pageViews: readonly { readonly path: string; readonly occurredAt: string; readonly visitorId?: string | null }[];
  readonly sessions: readonly { readonly startedAt: string }[];
  readonly engagedSeconds: readonly { readonly seconds: number; readonly occurredAt: string }[];
  readonly leads: readonly { readonly funnelName: string; readonly createdAt: string }[];
}): AnalyticsReport | null {
  const bounds = periodBounds(input.from, input.to);
  if (!bounds) return null;
  const views = input.pageViews.filter((row) => inPeriod(row.occurredAt, bounds.startIso, bounds.endIso));
  const sessions = input.sessions.filter((row) => inPeriod(row.startedAt, bounds.startIso, bounds.endIso));
  const engaged = input.engagedSeconds.filter((row) => inPeriod(row.occurredAt, bounds.startIso, bounds.endIso));
  const visitors = new Set(
    views.map((row) => readTrackingId(row.visitorId)).filter((id): id is string => id !== null),
  );
  const daysByVisitor = new Map<string, Set<string>>();
  for (const view of views) {
    const id = readTrackingId(view.visitorId);
    const day = torontoCivilDate(view.occurredAt);
    if (!id || !day) continue;
    const days = daysByVisitor.get(id) ?? new Set<string>();
    days.add(day);
    daysByVisitor.set(id, days);
  }
  let returnCount = 0;
  for (const days of daysByVisitor.values()) {
    if (days.size >= 2) returnCount += 1;
  }
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
    engagedSeconds: engaged.length === 0 ? { state: "trou" } : { state: "observe", count: engaged.reduce((sum, row) => sum + row.seconds, 0) },
    returns: views.length === 0 || daysByVisitor.size === 0 ? { state: "trou" } : { state: "observe", count: returnCount },
    leads: observedOrGap(leads.length),
    pages: pageRows.length === 0 ? { state: "trou" } : { state: "observe", rows: pageRows },
    conversions: funnelRows.length === 0 ? { state: "trou" } : { state: "observe", rows: funnelRows },
    notCollected: NOT_COLLECTED,
  };
}

export type TotalLine = {
  readonly kind: "total" | "page" | "funnel" | "compare" | "compare_page" | "compare_funnel" | "ecart";
  readonly name: string;
  readonly state: "observe" | "trou";
  readonly count: number | null;
};

const MEASURES = [
  ["pageViews", "page_views"],
  ["sessions", "sessions"],
  ["uniqueVisitors", "unique_visitors"],
  ["engagedSeconds", "engaged_seconds"],
  ["returns", "returns"],
  ["leads", "leads"],
] as const;

export type MeasureName = (typeof MEASURES)[number][1];

export function totalDelta(current: ObservedCount | Gap, baseline: ObservedCount | Gap): ObservedCount | Gap {
  if (current.state !== "observe" || baseline.state !== "observe") return { state: "trou" };
  return { state: "observe", count: current.count - baseline.count };
}

export function reportDeltas(current: AnalyticsReport, baseline: AnalyticsReport): { readonly name: MeasureName; readonly delta: ObservedCount | Gap }[] {
  return MEASURES.map(([key, name]) => ({ name, delta: totalDelta(current[key], baseline[key]) }));
}

export function reportTotalLines(report: AnalyticsReport): TotalLine[] {
  const lines: TotalLine[] = [
    { kind: "total", name: "page_views", state: report.pageViews.state, count: report.pageViews.state === "observe" ? report.pageViews.count : null },
    { kind: "total", name: "sessions", state: report.sessions.state, count: report.sessions.state === "observe" ? report.sessions.count : null },
    { kind: "total", name: "unique_visitors", state: report.uniqueVisitors.state, count: report.uniqueVisitors.state === "observe" ? report.uniqueVisitors.count : null },
    { kind: "total", name: "engaged_seconds", state: report.engagedSeconds.state, count: report.engagedSeconds.state === "observe" ? report.engagedSeconds.count : null },
    { kind: "total", name: "returns", state: report.returns.state, count: report.returns.state === "observe" ? report.returns.count : null },
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

function lineText(line: TotalLine): string {
  return `${line.kind} ${line.name} ${line.state} ${line.count === null ? "trou" : String(line.count)}`;
}

function renamedLines(lines: readonly TotalLine[], total: TotalLine["kind"], page: TotalLine["kind"], funnel: TotalLine["kind"]): TotalLine[] {
  return lines.map((line) => ({
    ...line,
    kind: line.kind === "total" ? total : line.kind === "page" ? page : funnel,
  }));
}

export function exportLines(report: AnalyticsReport, comparison?: AnalyticsReport): TotalLine[] {
  if (!comparison) return reportTotalLines(report);
  return [
    ...reportTotalLines(report),
    ...renamedLines(reportTotalLines(comparison), "compare", "compare_page", "compare_funnel"),
    ...reportDeltas(report, comparison).map((item) => ({
      kind: "ecart" as const,
      name: item.name,
      state: item.delta.state,
      count: item.delta.state === "observe" ? item.delta.count : null,
    })),
  ];
}

export function totalsSignature(report: AnalyticsReport): string {
  return reportTotalLines(report).map(lineText).join("\n");
}

export function exportSignature(report: AnalyticsReport, comparison?: AnalyticsReport): string {
  return exportLines(report, comparison).map(lineText).join("\n");
}

function totalsObject(report: AnalyticsReport) {
  return {
    page_views: report.pageViews,
    sessions: report.sessions,
    unique_visitors: report.uniqueVisitors,
    engaged_seconds: report.engagedSeconds,
    returns: report.returns,
    leads: report.leads,
  };
}

export function renderAnalyticsJson(report: AnalyticsReport, comparison?: AnalyticsReport): string {
  return JSON.stringify({
    version: report.version,
    timezone: report.timezone,
    from: report.from,
    to: report.to,
    totals: totalsObject(report),
    pages: report.pages,
    conversions: report.conversions,
    ...(comparison ? {
      comparison: {
        from: comparison.from,
        to: comparison.to,
        totals: totalsObject(comparison),
        pages: comparison.pages,
        conversions: comparison.conversions,
      },
      ecarts: Object.fromEntries(reportDeltas(report, comparison).map((item) => [item.name, item.delta])),
    } : {}),
    not_collected: report.notCollected,
    signature: exportSignature(report, comparison),
  });
}

export function renderAnalyticsCsv(report: AnalyticsReport, comparison?: AnalyticsReport): string {
  const rows = ["kind,name,state,count"];
  for (const line of exportLines(report, comparison)) {
    rows.push(`${line.kind},${line.name},${line.state},${line.count === null ? "" : String(line.count)}`);
  }
  return `${rows.join("\n")}\n`;
}

function pdfEscape(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

export const CHART_BAR_MAX = 120;

const CHART_LABELS = [
  ["page_views", "vues"],
  ["sessions", "sessions"],
  ["unique_visitors", "visiteurs"],
  ["engaged_seconds", "secondes"],
  ["returns", "retours"],
  ["leads", "demandes"],
] as const;

export type ChartTotalName = (typeof CHART_LABELS)[number][0];

export type ChartTotal = {
  readonly name: ChartTotalName;
  readonly state: "observe" | "trou";
  readonly count: number | null;
  readonly bar: number | null;
};

export function chartBarLength(count: number, maxCount: number): number {
  if (count <= 0 || maxCount <= 0) return 0;
  const scaled = Math.round((count / maxCount) * CHART_BAR_MAX);
  return Math.max(1, scaled);
}

function chartRows(report: AnalyticsReport): ChartTotal[] {
  const measures = [
    report.pageViews,
    report.sessions,
    report.uniqueVisitors,
    report.engagedSeconds,
    report.returns,
    report.leads,
  ];
  const maxCount = measures.reduce((max, item) => item.state === "observe" ? Math.max(max, item.count) : max, 0);
  return CHART_LABELS.map(([name], index) => {
    const measure = measures[index];
    if (!measure || measure.state === "trou") return { name, state: "trou", count: null, bar: null };
    return { name, state: "observe", count: measure.count, bar: chartBarLength(measure.count, maxCount) };
  });
}

function chartCommands(report: AnalyticsReport): string[] {
  const commands = [
    "BT",
    "/F1 11 Tf",
    "48 220 Td",
    "(Graphique des totaux mesures : vues, sessions, visiteurs, secondes, retours, demandes) Tj",
    "ET",
    "178 70 m",
    "178 205 l",
    "S",
  ];
  chartRows(report).forEach((row, index) => {
    const label = CHART_LABELS[index]?.[1] ?? row.name;
    const y = 190 - index * 18;
    if (row.bar !== null) commands.push(`${178} ${y - 3} ${row.bar} 10 re`, "f");
    const value = row.state === "observe" ? `observe ${row.count}` : "trou";
    commands.push("BT", "/F1 9 Tf", `48 ${y} Td`, `(graphique ${label} ${value}) Tj`, "ET");
  });
  return commands;
}

const CHART_ITEM = /(?:(\d+) (\d+) (\d+) 10 re\nf\n)?BT\n\/F1 9 Tf\n\d+ \d+ Td\n\(graphique (vues|sessions|visiteurs|secondes|retours|demandes) (observe|trou)(?: (\d+))?\) Tj\nET/g;

export function readChart(pdf: string): ChartTotal[] {
  const found = [...pdf.matchAll(CHART_ITEM)];
  if (found.length !== CHART_LABELS.length) throw new Error("Graphique incomplet.");
  return CHART_LABELS.map(([name, label], index) => {
    const match = found[index];
    if (!match || match[4] !== label) throw new Error("Graphique incomplet.");
    if (match[5] === "trou") {
      if (match[3] !== undefined) throw new Error("Un trou est dessiné.");
      return { name, state: "trou", count: null, bar: null };
    }
    if (match[3] === undefined || match[6] === undefined) throw new Error("Barre absente.");
    return { name, state: "observe", count: Number(match[6]), bar: Number(match[3]) };
  });
}

export function chartTotalsFromJson(json: string): Pick<ChartTotal, "name" | "state" | "count">[] {
  const parsed = JSON.parse(json) as { totals?: Record<string, { state?: string; count?: number }> };
  return CHART_LABELS.map(([name]) => {
    const row = parsed.totals?.[name];
    if (row?.state === "observe" && typeof row.count === "number") return { name, state: "observe", count: row.count };
    return { name, state: "trou", count: null };
  });
}

export function chartTotalsFromCsv(csv: string): Pick<ChartTotal, "name" | "state" | "count">[] {
  const lines = signatureFromCsv(csv).split("\n");
  return CHART_LABELS.map(([name]) => {
    const line = lines.find((item) => item.startsWith(`total ${name} `));
    if (!line) throw new Error("Total absent du CSV.");
    const [, , state, countText] = line.split(" ");
    if (state === "observe") return { name, state: "observe", count: Number(countText) };
    return { name, state: "trou", count: null };
  });
}

export function renderAnalyticsPdf(report: AnalyticsReport, comparison?: AnalyticsReport): string {
  const signatureLines = exportSignature(report, comparison).split("\n");
  const primaryCount = reportTotalLines(report).length;
  const lines = [
    "Maisons Quebec",
    `periode ${report.from} ${report.to}`,
    "fuseau America/Toronto",
    ...signatureLines.slice(0, primaryCount),
    ...(comparison ? [`comparaison ${comparison.from} ${comparison.to}`, ...signatureLines.slice(primaryCount)] : []),
    "non collecte Search Console taux par page",
  ];
  const commands = ["BT", "/F1 11 Tf", "72 740 Td"];
  lines.forEach((line, index) => {
    if (index > 0) commands.push("0 -16 Td");
    commands.push(`(${pdfEscape(line)}) Tj`);
  });
  commands.push("ET", ...chartCommands(report));
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
  return matches.filter((line) => /^(total|page|funnel|compare_page|compare_funnel|compare|ecart) /.test(line)).join("\n");
}
