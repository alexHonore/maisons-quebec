import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FORMULA_STATEMENT,
  applyPartsPerMillion,
  calculateSaleProceeds,
  calculateSaleProceedsScenarios,
  type SaleProceedsInput,
} from "./sale-proceeds";

const central: SaleProceedsInput = {
  salePriceCents: 50_000_000,
  mortgageBalanceCents: 20_000_000,
  brokerage: { kind: "rate", partsPerMillion: 50_000 },
  taxesOnBrokerage: [
    { code: "tps", label: "Taxe hypothétique A", partsPerMillion: 50_000 },
    { code: "tvq", label: "Taxe hypothétique B", partsPerMillion: 99_750 },
  ],
  mortgagePenaltyCents: null,
  legalFeesCents: 150_000,
  otherExpensesCents: 50_000,
};

function mustValue(input: SaleProceedsInput) {
  const result = calculateSaleProceeds(input);
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

describe("applyPartsPerMillion", () => {
  it("arrondit half-up sans taxe sur taxe", () => {
    assert.equal(applyPartsPerMillion(1, 500_000), 1);
    assert.equal(applyPartsPerMillion(1, 499_999), 0);
    assert.equal(applyPartsPerMillion(10, 150_000), 2);
    assert.equal(applyPartsPerMillion(2_500_000, 99_750), 249_375);
    assert.equal(applyPartsPerMillion(50_000_000, 50_000), 2_500_000);
  });

  it("refuse un montant ou un taux hors limites", () => {
    assert.throws(() => applyPartsPerMillion(-1, 1), RangeError);
    assert.throws(() => applyPartsPerMillion(1.5, 1), RangeError);
    assert.throws(() => applyPartsPerMillion(100, 1_000_001), RangeError);
  });
});

describe("calculateSaleProceeds", () => {
  it("calcule le cas central et exclut la pénalité inconnue", () => {
    const value = mustValue(central);
    assert.equal(value.brokerageBeforeTaxCents, 2_500_000);
    assert.equal(value.taxesOnBrokerageCents, 125_000 + 249_375);
    assert.equal(value.debitsCents, 23_074_375);
    assert.equal(value.netProceedsCents, 26_925_625);
    assert.equal(value.hypothetical, true);
    assert.equal(value.certifiedAppraisal, false);
    assert.equal(value.taxCompounding, false);
    assert.equal(value.currency, "CAD");
    assert.deepEqual(value.excluded, ["mortgage_penalty", "personal_tax"]);
    assert.ok(value.warningCodes.includes("mortgage_penalty_unknown"));
    assert.ok(value.warningCodes.includes("personal_tax_excluded"));
    assert.ok(value.warningCodes.includes("hypothetical_not_appraisal"));
    assert.ok(!value.warningCodes.includes("negative_net"));
    assert.ok(value.limitations.includes(FORMULA_STATEMENT.limit));
    const penalty = value.lines.find((line) => line.code === "mortgage_penalty");
    assert.equal(penalty?.effect, "excluded");
    assert.equal(penalty?.amountCents, null);
    assert.match(penalty?.note ?? "", /n'est pas estimée/);
  });

  it("inclut une pénalité seulement lorsqu'elle est fournie", () => {
    const value = mustValue({ ...central, mortgagePenaltyCents: 100_000 });
    assert.equal(value.netProceedsCents, 26_825_625);
    assert.equal(value.lines.find((line) => line.code === "mortgage_penalty")?.effect, "debit");
    assert.ok(!value.warningCodes.includes("mortgage_penalty_unknown"));
    assert.ok(value.excluded.includes("personal_tax"));
    assert.ok(!value.excluded.includes("mortgage_penalty"));
  });

  it("n'empile pas les taxes", () => {
    const value = mustValue({
      salePriceCents: 1_000_000,
      mortgageBalanceCents: 0,
      brokerage: { kind: "fixed", amountCents: 10_000 },
      taxesOnBrokerage: [
        { code: "a", label: "A", partsPerMillion: 50_000 },
        { code: "b", label: "B", partsPerMillion: 99_750 },
      ],
      mortgagePenaltyCents: 0,
      legalFeesCents: 0,
      otherExpensesCents: 0,
    });
    const taxB = value.lines.find((line) => line.code === "tax_b");
    assert.equal(taxB?.amountCents, 998);
    assert.notEqual(taxB?.amountCents, 1047);
    assert.equal(value.taxesOnBrokerageCents, 500 + 998);
  });

  it("signale un produit négatif et l'absence de taxe", () => {
    const value = mustValue({
      salePriceCents: 10_000_000,
      mortgageBalanceCents: 15_000_000,
      brokerage: { kind: "fixed", amountCents: 0 },
      taxesOnBrokerage: [],
      mortgagePenaltyCents: null,
      legalFeesCents: 0,
      otherExpensesCents: 0,
    });
    assert.equal(value.netProceedsCents, -5_000_000);
    assert.ok(value.warningCodes.includes("negative_net"));
    assert.ok(value.warningCodes.includes("no_tax_on_brokerage"));
  });

  it("signale un courtage plus élevé que le prix", () => {
    const value = mustValue({
      salePriceCents: 100,
      mortgageBalanceCents: 0,
      brokerage: { kind: "fixed", amountCents: 200 },
      taxesOnBrokerage: [],
      mortgagePenaltyCents: null,
      legalFeesCents: 0,
      otherExpensesCents: 0,
    });
    assert.equal(value.netProceedsCents, -100);
    assert.ok(value.warningCodes.includes("brokerage_exceeds_sale_price"));
  });

  it("rejette les saisies invalides sans produire de montant", () => {
    const result = calculateSaleProceeds({
      ...central,
      salePriceCents: 0,
      mortgageBalanceCents: -1,
      brokerage: { kind: "rate", partsPerMillion: 1_000_001 },
      taxesOnBrokerage: [
        { code: "tps", label: "A", partsPerMillion: 50_000 },
        { code: "tps", label: "B", partsPerMillion: 50_000 },
      ],
      mortgagePenaltyCents: 1.5,
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    const fields = result.errors.map((error) => error.field);
    assert.ok(fields.includes("salePriceCents"));
    assert.ok(fields.includes("mortgageBalanceCents"));
    assert.ok(fields.includes("brokerage.partsPerMillion"));
    assert.ok(fields.includes("taxesOnBrokerage[1].code"));
    assert.ok(fields.includes("mortgagePenaltyCents"));
    assert.match(result.errors[0]?.message ?? "", /[àâéèêù]/i);
  });

  it("ne mute pas la saisie", () => {
    const snapshot = structuredClone(central);
    mustValue(central);
    assert.deepEqual(central, snapshot);
  });
});

describe("calculateSaleProceedsScenarios", () => {
  it("conserve l'ordre et isole une saisie invalide", () => {
    const base = { ...central, mortgagePenaltyCents: 0, taxesOnBrokerage: [] as const, legalFeesCents: 0, otherExpensesCents: 0 };
    const results = calculateSaleProceedsScenarios([
      {
        id: "prudent",
        label: "Prudent",
        assumptions: ["Courtage hypothétique plus élevé."],
        input: { ...base, brokerage: { kind: "rate", partsPerMillion: 60_000 } },
      },
      {
        id: "invalide",
        label: "Invalide",
        assumptions: ["Prix refusé."],
        input: { ...base, salePriceCents: -5, brokerage: { kind: "rate", partsPerMillion: 40_000 } },
      },
      {
        id: "optimiste",
        label: "Optimiste",
        assumptions: ["Courtage hypothétique plus bas."],
        input: { ...base, brokerage: { kind: "rate", partsPerMillion: 40_000 } },
      },
    ]);

    assert.deepEqual(results.map((scenario) => scenario.id), ["prudent", "invalide", "optimiste"]);
    assert.equal(results[1]?.result.ok, false);
    const prudent = results[0]?.result;
    const optimistic = results[2]?.result;
    assert.equal(prudent?.ok, true);
    assert.equal(optimistic?.ok, true);
    if (!prudent?.ok || !optimistic?.ok) return;
    assert.ok(optimistic.value.netProceedsCents > prudent.value.netProceedsCents);
    assert.equal(results[0]?.assumptions[0], "Courtage hypothétique plus élevé.");
  });
});
