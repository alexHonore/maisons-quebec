import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REGULATORY_EMPTY_LABEL } from "./regulatory-identity";
import {
  DEDUP_KEY,
  DEDUP_KEY_RULE,
  buildHonestResult,
  confirmableSlot,
  parseFunnelFields,
} from "./honest-funnels";

const estimationFields = {
  municipality: "Sillery",
  property_type: "condo",
  year_band: "recente",
  surface_band: "moyenne",
  bedrooms: "deux",
  condition: "travaux_a_prevoir",
};

describe("funnels honnêtes", () => {
  it("documente une clé de dédoublonnage qui n'est pas un soupçon", () => {
    assert.equal(DEDUP_KEY, "contact_email_normalise+funnel_name");
    assert.match(DEDUP_KEY_RULE, /ne sont jamais fusionnés/);
    assert.doesNotMatch(DEDUP_KEY_RULE, /score|similaire|probab/i);
  });

  it("prépare une estimation sans prix et sans comparable inventé", () => {
    const parsed = parseFunnelFields("estimation_maison", estimationFields);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = buildHonestResult(parsed.draft);
    assert.ok(result);
    if (!result || result.funnelName !== "estimation_maison") return;
    assert.equal(result.certifiedAppraisal, false);
    assert.equal(result.guaranteedMarketValue, false);
    assert.equal(result.priceCents, null);
    assert.equal(result.comparables, REGULATORY_EMPTY_LABEL);
    const text = JSON.stringify(result);
    assert.equal(text.includes("$"), false);
    assert.equal(text.includes("%"), false);
    assert.match(text, /Sillery/);
    assert.equal(parseFunnelFields("estimation_maison", { ...estimationFields, municipality: "12 rue du Quai" }).ok, false);
  });

  it("ne calcule ni crédit ni financement pour vendre avant d'acheter", () => {
    const parsed = parseFunnelFields("vendre_avant_acheter", { scenario: "acheter_puis_vendre", horizon: "indecis" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = buildHonestResult(parsed.draft);
    assert.ok(result && result.funnelName === "vendre_avant_acheter" && result.creditApproval === false && result.financingCents === null);
    const text = JSON.stringify(result);
    assert.equal(text.includes("$"), false);
    assert.match(text, /Aucune approbation de crédit/);
    assert.match(text, new RegExp(REGULATORY_EMPTY_LABEL));
  });

  it("n'invente aucun quartier ni inventaire", () => {
    const parsed = parseFunnelFields("comparer_quartiers", {
      setting: "tranquille",
      property_type: "maison",
      transport: "proche",
      schools: "indifferent",
      shops: "proche",
      parks: "indifferent",
    });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = buildHonestResult(parsed.draft);
    assert.ok(result && result.funnelName === "comparer_quartiers");
    if (!result || result.funnelName !== "comparer_quartiers") return;
    assert.deepEqual(result.recommendedAreas, []);
    assert.equal(result.inventoryCount, null);
    const text = JSON.stringify(result);
    assert.doesNotMatch(text, /Limoilou|Charlesbourg|Beauport|Sainte-Foy|Saint-Nicolas|Lévis/);
    assert.match(text, /Quartiers compatibles : À compléter — donnée non fournie/);
  });

  it("sépare les coûts d'achat sans mensualité ni taux caché", () => {
    const parsed = parseFunnelFields("cout_total_achat", { focus: "les_deux" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = buildHonestResult(parsed.draft);
    assert.ok(result && result.funnelName === "cout_total_achat");
    if (!result || result.funnelName !== "cout_total_achat") return;
    assert.equal(result.mortgageRate, null);
    assert.equal(result.monthlyPaymentCents, null);
    assert.equal(result.welcomeTaxCents, null);
    assert.equal(result.totalCents, null);
    assert.equal(result.preapproval, false);
    const text = JSON.stringify(result);
    assert.equal(text.includes("$"), false);
    assert.equal(text.includes("%"), false);
    assert.match(text, /Non calculée/);
  });

  it("compte les tâches cochées sans note de qualité", () => {
    const parsed = parseFunnelFields("preparer_sa_maison", { tasks: "photos,titre,titre" });
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    const result = buildHonestResult(parsed.draft);
    assert.ok(result && result.funnelName === "preparer_sa_maison");
    if (!result || result.funnelName !== "preparer_sa_maison") return;
    assert.equal(result.checkedCount, 2);
    assert.equal(result.taskCount, 7);
    assert.equal(result.certifiedQualityScore, false);
    assert.match(result.caveat, /n'est pas une note de qualité certifiée/);
    assert.equal(parseFunnelFields("preparer_sa_maison", { tasks: "prix" }).ok, false);
    const empty = parseFunnelFields("preparer_sa_maison", {});
    assert.equal(empty.ok, true);
    if (!empty.ok) return;
    const zero = buildHonestResult(empty.draft);
    assert.ok(zero && zero.funnelName === "preparer_sa_maison" && zero.checkedCount === 0);
  });

  it("refuse un créneau qui n'est que le libellé vide", () => {
    assert.equal(confirmableSlot(""), null);
    assert.equal(confirmableSlot(REGULATORY_EMPTY_LABEL), null);
    assert.equal(confirmableSlot(`  ${REGULATORY_EMPTY_LABEL}  `), null);
    assert.equal(confirmableSlot("mardi matin"), "mardi matin");
  });
});
