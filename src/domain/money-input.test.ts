import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dollarsToCents, percentToPartsPerMillion } from "./money-input";

describe("saisie monétaire", () => {
  it("convertit les dollars saisis et refuse un montant ambigu", () => {
    assert.equal(dollarsToCents(""), null);
    assert.equal(dollarsToCents(" 500 000 "), 50_000_000);
    assert.equal(dollarsToCents("10,5"), 1_050);
    assert.equal(dollarsToCents("10.50"), 1_050);
    assert.equal(dollarsToCents("10,555"), null);
    assert.equal(dollarsToCents("abc"), null);
  });

  it("convertit un pourcentage saisi sans fournir de barème", () => {
    assert.equal(percentToPartsPerMillion(""), null);
    assert.equal(percentToPartsPerMillion("5"), 50_000);
    assert.equal(percentToPartsPerMillion("9,975"), 99_750);
    assert.equal(percentToPartsPerMillion("101"), null);
  });
});
