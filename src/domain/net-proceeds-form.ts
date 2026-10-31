import { dollarsToCents, percentToPartsPerMillion } from "./money-input";
import type { FeeTax, SaleProceedsInput } from "./sale-proceeds";

export const OFFICIAL_RATES_MISSING = "À compléter — donnée non fournie";

export function netProceedsInputFromFields(fields: {
  sale: string;
  mortgage: string;
  brokerageKind: string;
  brokerageValue: string;
  taxA: string;
  taxB: string;
  penalty: string;
  legal: string;
  other: string;
}): { ok: true; input: SaleProceedsInput } | { ok: false; message: string } {
  const salePriceCents = dollarsToCents(fields.sale);
  const mortgageBalanceCents = dollarsToCents(fields.mortgage) ?? 0;
  const legalFeesCents = dollarsToCents(fields.legal) ?? 0;
  const otherExpensesCents = dollarsToCents(fields.other) ?? 0;
  if (salePriceCents === null) return { ok: false, message: "Le prix de vente hypothétique est requis, en dollars." };
  if (fields.mortgage.trim() !== "" && dollarsToCents(fields.mortgage) === null) {
    return { ok: false, message: "Le solde hypothécaire n'est pas un montant lisible." };
  }
  if (fields.legal.trim() !== "" && dollarsToCents(fields.legal) === null) {
    return { ok: false, message: "Les frais légaux ne sont pas un montant lisible." };
  }
  if (fields.other.trim() !== "" && dollarsToCents(fields.other) === null) {
    return { ok: false, message: "Les autres dépenses ne sont pas un montant lisible." };
  }

  let brokerage: SaleProceedsInput["brokerage"];
  if (fields.brokerageKind === "rate") {
    const partsPerMillion = percentToPartsPerMillion(fields.brokerageValue);
    if (partsPerMillion === null) return { ok: false, message: "Indiquez le taux de courtage que vous voulez tester." };
    brokerage = { kind: "rate", partsPerMillion };
  } else {
    const amountCents = dollarsToCents(fields.brokerageValue);
    if (amountCents === null) return { ok: false, message: "Indiquez les frais de courtage en dollars." };
    brokerage = { kind: "fixed", amountCents };
  }

  const taxesOnBrokerage: FeeTax[] = [];
  const taxA = percentToPartsPerMillion(fields.taxA);
  const taxB = percentToPartsPerMillion(fields.taxB);
  if (fields.taxA.trim() !== "" && taxA === null) return { ok: false, message: "La taxe A n'est pas un pourcentage lisible." };
  if (fields.taxB.trim() !== "" && taxB === null) return { ok: false, message: "La taxe B n'est pas un pourcentage lisible." };
  if (taxA !== null) taxesOnBrokerage.push({ code: "taxe_a", label: "Taxe sur honoraires A, taux saisi", partsPerMillion: taxA });
  if (taxB !== null) taxesOnBrokerage.push({ code: "taxe_b", label: "Taxe sur honoraires B, taux saisi", partsPerMillion: taxB });

  let mortgagePenaltyCents: number | null = null;
  if (fields.penalty.trim() !== "") {
    mortgagePenaltyCents = dollarsToCents(fields.penalty);
    if (mortgagePenaltyCents === null) return { ok: false, message: "La pénalité n'est pas un montant lisible." };
  }

  return {
    ok: true,
    input: {
      salePriceCents,
      mortgageBalanceCents,
      brokerage,
      taxesOnBrokerage,
      mortgagePenaltyCents,
      legalFeesCents,
      otherExpensesCents,
    },
  };
}
