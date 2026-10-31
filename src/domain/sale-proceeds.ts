/**
 * Produit net approximatif d'une vente hypothétique.
 * Montants en cents CAD entiers. Aucun taux légal n'est embarqué.
 * Chaque taxe s'applique aux honoraires hors taxes, sans taxe sur taxe.
 * La fiscalité personnelle n'est jamais calculée.
 * La pénalité hypothécaire inconnue n'est pas estimée.
 */

export const MAX_MONEY_CENTS = 1_000_000_000_000_00;

export const FORMULA_STATEMENT = {
  included:
    "Prix de vente hypothétique, solde hypothécaire, frais de courtage paramétrables, taxes calculées sur les honoraires hors taxes selon les taux fournis, frais légaux et autres dépenses saisis tels quels, pénalité hypothécaire seulement si le montant est connu.",
  excluded:
    "Fiscalité personnelle, pénalité hypothécaire inconnue (elle n'est pas estimée), tout barème officiel non fourni par l'appelant.",
  limit:
    "Résultat informatif et hypothétique. Ce n'est pas une évaluation certifiée, ni un avis fiscal, ni un avis juridique.",
} as const;

export type Brokerage =
  | { readonly kind: "fixed"; readonly amountCents: number }
  | { readonly kind: "rate"; readonly partsPerMillion: number };

export type FeeTax = {
  readonly code: string;
  readonly label: string;
  /** Parts par million des honoraires hors taxes. 50_000 = 5 %. 99_750 = 9,975 %. */
  readonly partsPerMillion: number;
};

export type SaleProceedsInput = {
  readonly salePriceCents: number;
  readonly mortgageBalanceCents: number;
  readonly brokerage: Brokerage;
  readonly taxesOnBrokerage: readonly FeeTax[];
  /** `null` : montant inconnu, exclu, non estimé. */
  readonly mortgagePenaltyCents: number | null;
  readonly legalFeesCents: number;
  readonly otherExpensesCents: number;
};

export type LineEffect = "credit" | "debit" | "excluded";

export type MoneyLine = {
  readonly code: string;
  readonly label: string;
  readonly amountCents: number | null;
  readonly effect: LineEffect;
  readonly note: string;
};

export type SaleProceeds = {
  readonly currency: "CAD";
  readonly unit: "cents";
  readonly hypothetical: true;
  readonly certifiedAppraisal: false;
  readonly taxBase: "honoraires_hors_taxes";
  readonly taxCompounding: false;
  readonly salePriceCents: number;
  readonly brokerageBeforeTaxCents: number;
  readonly taxesOnBrokerageCents: number;
  readonly debitsCents: number;
  readonly netProceedsCents: number;
  readonly lines: readonly MoneyLine[];
  readonly included: readonly string[];
  readonly excluded: readonly string[];
  readonly warningCodes: readonly string[];
  readonly limitations: readonly string[];
};

export type InputError = {
  readonly field: string;
  readonly message: string;
};

export type SaleProceedsResult =
  | { readonly ok: true; readonly value: SaleProceeds }
  | { readonly ok: false; readonly errors: readonly InputError[] };

export type ScenarioInput = {
  readonly id: string;
  readonly label: string;
  readonly assumptions: readonly string[];
  readonly input: SaleProceedsInput;
};

export type ScenarioResult = {
  readonly id: string;
  readonly label: string;
  readonly assumptions: readonly string[];
  readonly result: SaleProceedsResult;
};

const TAX_CODE = /^[a-z0-9_]{1,40}$/;

export function applyPartsPerMillion(amountCents: number, partsPerMillion: number): number {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0 || amountCents > MAX_MONEY_CENTS) {
    throw new RangeError("montant hors limites");
  }
  if (
    !Number.isSafeInteger(partsPerMillion) ||
    partsPerMillion < 0 ||
    partsPerMillion > 1_000_000
  ) {
    throw new RangeError("taux hors limites");
  }

  const high = Math.floor(amountCents / 1_000_000);
  const low = amountCents % 1_000_000;
  const fromHigh = high * partsPerMillion;
  const lowProduct = low * partsPerMillion;
  const fromLow = Math.floor(lowProduct / 1_000_000);
  const remainder = lowProduct % 1_000_000;
  const roundedLow = remainder >= 500_000 ? fromLow + 1 : fromLow;
  const result = fromHigh + roundedLow;
  if (!Number.isSafeInteger(result)) {
    throw new RangeError("résultat hors limites");
  }
  return result;
}

function isMoney(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= MAX_MONEY_CENTS && !Object.is(value, -0);
}

function pushMoneyError(errors: InputError[], field: string, value: unknown, label: string, allowZero: boolean): void {
  if (!isMoney(value) || (!allowZero && value === 0)) {
    errors.push({
      field,
      message: allowZero
        ? `${label} doit être un entier de cents entre 0 et la limite admise.`
        : `${label} doit être un entier de cents supérieur à zéro.`,
    });
  }
}

function validate(input: SaleProceedsInput): InputError[] {
  const errors: InputError[] = [];
  if (input === null || typeof input !== "object") {
    return [{ field: "input", message: "La saisie du calcul est absente." }];
  }

  pushMoneyError(errors, "salePriceCents", input.salePriceCents, "Le prix de vente", false);
  pushMoneyError(errors, "mortgageBalanceCents", input.mortgageBalanceCents, "Le solde hypothécaire", true);
  pushMoneyError(errors, "legalFeesCents", input.legalFeesCents, "Les frais légaux", true);
  pushMoneyError(errors, "otherExpensesCents", input.otherExpensesCents, "Les autres dépenses", true);

  if (input.mortgagePenaltyCents !== null && !isMoney(input.mortgagePenaltyCents)) {
    errors.push({
      field: "mortgagePenaltyCents",
      message: "La pénalité hypothécaire doit être un entier de cents, ou null si elle est inconnue.",
    });
  }

  const brokerage = input.brokerage;
  if (!brokerage || typeof brokerage !== "object") {
    errors.push({ field: "brokerage", message: "Le courtage doit être un montant fixe ou un taux." });
  } else if (brokerage.kind === "fixed") {
    pushMoneyError(errors, "brokerage.amountCents", brokerage.amountCents, "Les frais de courtage", true);
  } else if (brokerage.kind === "rate") {
    if (
      !Number.isSafeInteger(brokerage.partsPerMillion) ||
      brokerage.partsPerMillion < 0 ||
      brokerage.partsPerMillion > 1_000_000
    ) {
      errors.push({
        field: "brokerage.partsPerMillion",
        message: "Le taux de courtage doit être un entier entre 0 et 1 000 000 parts par million.",
      });
    }
  } else {
    errors.push({ field: "brokerage.kind", message: "Le courtage doit être de type fixed ou rate." });
  }

  if (!Array.isArray(input.taxesOnBrokerage)) {
    errors.push({ field: "taxesOnBrokerage", message: "Les taxes sur honoraires doivent être une liste." });
  } else {
    const seen = new Set<string>();
    input.taxesOnBrokerage.forEach((tax, index) => {
      const field = `taxesOnBrokerage[${index}]`;
      if (!tax || typeof tax !== "object") {
        errors.push({ field, message: "Une taxe sur honoraires est illisible." });
        return;
      }
      if (typeof tax.code !== "string" || !TAX_CODE.test(tax.code)) {
        errors.push({
          field: `${field}.code`,
          message: "Le code de taxe doit contenir de 1 à 40 caractères a-z, 0-9 ou _.",
        });
      } else if (seen.has(tax.code)) {
        errors.push({ field: `${field}.code`, message: `Le code de taxe « ${tax.code} » est répété.` });
      } else {
        seen.add(tax.code);
      }
      if (typeof tax.label !== "string" || tax.label.trim() === "" || tax.label.trim().length > 80) {
        errors.push({ field: `${field}.label`, message: "Le libellé de taxe est requis (80 caractères maximum)." });
      }
      if (!Number.isSafeInteger(tax.partsPerMillion) || tax.partsPerMillion < 0 || tax.partsPerMillion > 1_000_000) {
        errors.push({
          field: `${field}.partsPerMillion`,
          message: "Le taux de taxe doit être un entier entre 0 et 1 000 000 parts par million.",
        });
      }
    });
  }

  return errors;
}

export function calculateSaleProceeds(input: SaleProceedsInput): SaleProceedsResult {
  const errors = validate(input);
  if (errors.length > 0) return { ok: false, errors };

  const brokerageBeforeTaxCents =
    input.brokerage.kind === "fixed"
      ? input.brokerage.amountCents
      : applyPartsPerMillion(input.salePriceCents, input.brokerage.partsPerMillion);

  const taxLines: MoneyLine[] = input.taxesOnBrokerage.map((tax) => {
    const amountCents = applyPartsPerMillion(brokerageBeforeTaxCents, tax.partsPerMillion);
    return {
      code: `tax_${tax.code}`,
      label: tax.label.trim(),
      amountCents,
      effect: "debit",
      note: "Taxe calculée sur les honoraires hors taxes, sans taxe sur taxe. Le taux vient de la saisie.",
    };
  });
  const taxesOnBrokerageCents = taxLines.reduce((sum, line) => sum + (line.amountCents ?? 0), 0);

  const penaltyKnown = input.mortgagePenaltyCents !== null;
  const warningCodes = [
    "hypothetical_not_appraisal",
    "personal_tax_excluded",
    "legal_fees_taken_as_given",
  ];
  if (!penaltyKnown) warningCodes.push("mortgage_penalty_unknown");
  if (input.taxesOnBrokerage.length === 0) warningCodes.push("no_tax_on_brokerage");
  if (brokerageBeforeTaxCents > input.salePriceCents) warningCodes.push("brokerage_exceeds_sale_price");

  const lines: MoneyLine[] = [
    {
      code: "sale_price",
      label: "Prix de vente hypothétique",
      amountCents: input.salePriceCents,
      effect: "credit",
      note: "Montant saisi. Ce n'est pas un prix de marché observé.",
    },
    {
      code: "mortgage_balance",
      label: "Solde hypothécaire",
      amountCents: input.mortgageBalanceCents,
      effect: "debit",
      note: "Montant saisi, déduit tel quel.",
    },
    {
      code: "brokerage",
      label: "Frais de courtage hors taxes",
      amountCents: brokerageBeforeTaxCents,
      effect: "debit",
      note:
        input.brokerage.kind === "fixed"
          ? "Montant fixe saisi."
          : "Taux saisi, appliqué au prix de vente hypothétique.",
    },
    ...taxLines,
    {
      code: "mortgage_penalty",
      label: "Pénalité de remboursement hypothécaire",
      amountCents: penaltyKnown ? input.mortgagePenaltyCents : null,
      effect: penaltyKnown ? "debit" : "excluded",
      note: penaltyKnown
        ? "Montant connu, saisi par l'appelant. Ce n'est pas une estimation."
        : "Montant inconnu. La pénalité est exclue et n'est pas estimée.",
    },
    {
      code: "legal_fees",
      label: "Frais légaux",
      amountCents: input.legalFeesCents,
      effect: "debit",
      note: "Montant saisi tel quel. Aucune taxe n'est ajoutée automatiquement.",
    },
    {
      code: "other_expenses",
      label: "Autres dépenses",
      amountCents: input.otherExpensesCents,
      effect: "debit",
      note: "Montant saisi tel quel.",
    },
    {
      code: "personal_tax",
      label: "Fiscalité personnelle",
      amountCents: null,
      effect: "excluded",
      note: "Toujours exclue. Ce calcul ne produit pas un avis fiscal.",
    },
  ];

  const debitsCents = lines.reduce((sum, line) => {
    if (line.effect !== "debit" || line.amountCents === null) return sum;
    return sum + line.amountCents;
  }, 0);
  const netProceedsCents = input.salePriceCents - debitsCents;
  if (netProceedsCents < 0) warningCodes.push("negative_net");

  const included = lines.filter((line) => line.effect !== "excluded").map((line) => line.code);
  const excluded = lines.filter((line) => line.effect === "excluded").map((line) => line.code);

  return {
    ok: true,
    value: {
      currency: "CAD",
      unit: "cents",
      hypothetical: true,
      certifiedAppraisal: false,
      taxBase: "honoraires_hors_taxes",
      taxCompounding: false,
      salePriceCents: input.salePriceCents,
      brokerageBeforeTaxCents,
      taxesOnBrokerageCents,
      debitsCents,
      netProceedsCents,
      lines,
      included,
      excluded,
      warningCodes,
      limitations: [FORMULA_STATEMENT.limit, FORMULA_STATEMENT.included, FORMULA_STATEMENT.excluded],
    },
  };
}

export function calculateSaleProceedsScenarios(scenarios: readonly ScenarioInput[]): readonly ScenarioResult[] {
  return scenarios.map((scenario) => ({
    id: scenario.id,
    label: scenario.label,
    assumptions: scenario.assumptions,
    result: calculateSaleProceeds(scenario.input),
  }));
}
