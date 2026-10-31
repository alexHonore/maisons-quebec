import { netProceedsInputFromFields } from "./net-proceeds-form";
import { calculateSaleProceeds, type SaleProceeds, type SaleProceedsInput } from "./sale-proceeds";

export const NET_PROCEEDS_PAGE_PATH = "/vendre/calculateur-produit-net";

/** Entrées du calcul seulement. Jamais un nom, un courriel ou un consentement. */
export const NET_PROCEEDS_LINK_KEYS = [
  "vente",
  "hypotheque",
  "courtage",
  "valeur",
  "taxe_a",
  "taxe_b",
  "penalite",
  "legal",
  "autres",
] as const;

export type NetProceedsLinkKey = (typeof NET_PROCEEDS_LINK_KEYS)[number];

const PRIVATE_KEYS = new Set([
  "email",
  "courriel",
  "name",
  "nom",
  "consent",
  "consentement",
  "consent_respond",
  "consent_marketing",
  "telephone",
  "phone",
  "adresse",
]);

export type NetProceedsLinkFields = Record<NetProceedsLinkKey, string>;

export type QueryValue = string | readonly string[] | undefined;

export type NetProceedsQuery = { readonly [key: string]: QueryValue };

export type NetProceedsLink =
  | { readonly present: false }
  | {
      readonly present: true;
      readonly ok: true;
      readonly fields: NetProceedsLinkFields;
      readonly href: string;
      readonly input: SaleProceedsInput;
      readonly result: SaleProceeds;
    }
  | {
      readonly present: true;
      readonly ok: false;
      readonly reason: "saisie";
      readonly fields: NetProceedsLinkFields;
      readonly href: string;
    };

function first(value: QueryValue): string {
  if (typeof value === "string") return value;
  if (value === undefined) return "";
  return value[0] ?? "";
}

function blankFields(): NetProceedsLinkFields {
  return {
    vente: "",
    hypotheque: "",
    courtage: "",
    valeur: "",
    taxe_a: "",
    taxe_b: "",
    penalite: "",
    legal: "",
    autres: "",
  };
}

function clean(raw: string): string {
  const value = raw.trim();
  if (value.includes("@")) return "";
  return value;
}

export function netProceedsLinkHref(fields: NetProceedsLinkFields): string {
  const params = new URLSearchParams();
  for (const key of NET_PROCEEDS_LINK_KEYS) {
    const value = fields[key];
    if (value !== "") params.set(key, value);
  }
  const query = params.toString();
  return query ? `${NET_PROCEEDS_PAGE_PATH}?${query}` : NET_PROCEEDS_PAGE_PATH;
}

export function readNetProceedsLink(query: NetProceedsQuery): NetProceedsLink {
  const fields = blankFields();
  for (const key of NET_PROCEEDS_LINK_KEYS) {
    const value = clean(first(query[key]));
    if (key === "courtage") {
      fields.courtage = value === "fixe" || value === "taux" ? value : "";
      continue;
    }
    fields[key] = value;
  }
  const present = NET_PROCEEDS_LINK_KEYS.some((key) => fields[key] !== "");
  if (!present) return { present: false };
  const href = netProceedsLinkHref(fields);
  if (fields.courtage === "" && first(query.courtage).trim() !== "") {
    return { present: true, ok: false, reason: "saisie", fields, href };
  }
  const parsed = netProceedsInputFromFields({
    sale: fields.vente,
    mortgage: fields.hypotheque,
    brokerageKind: fields.courtage === "taux" ? "rate" : "fixed",
    brokerageValue: fields.valeur,
    taxA: fields.taxe_a,
    taxB: fields.taxe_b,
    penalty: fields.penalite,
    legal: fields.legal,
    other: fields.autres,
  });
  if (!parsed.ok) return { present: true, ok: false, reason: "saisie", fields, href };
  const calculated = calculateSaleProceeds(parsed.input);
  if (!calculated.ok) return { present: true, ok: false, reason: "saisie", fields, href };
  return { present: true, ok: true, fields, href, input: parsed.input, result: calculated.value };
}

export function formatCadCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${sign}${grouped},${fraction} CAD`;
}

export function netProceedsResultSentence(cents: number): string {
  return `Produit net : ${formatCadCents(cents)}`;
}

export function queryDropsPrivate(query: NetProceedsQuery): boolean {
  return Object.keys(query).some((key) => PRIVATE_KEYS.has(key.toLowerCase()));
}
