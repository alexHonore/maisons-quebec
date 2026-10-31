import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NetProceedsResult } from "../components/net-proceeds-result";
import { netProceedsInputFromFields } from "./net-proceeds-form";
import {
  netProceedsResultSentence,
  queryDropsPrivate,
  readNetProceedsLink,
} from "./net-proceeds-link";
import { calculateSaleProceeds } from "./sale-proceeds";

const email = "personne@example.com";

describe("lien profond du produit net", () => {
  it("calcule l'URL avec le même module que le formulaire, sans reprendre un courriel", () => {
    const query = {
      vente: "500000",
      hypotheque: "200000",
      courtage: "fixe",
      valeur: "10000",
      legal: "1500",
      email,
      nom: "Personne Test",
      consentement: "on",
    };
    const link = readNetProceedsLink(query);
    assert.equal(link.present, true);
    if (!link.present || !link.ok) return;
    const direct = netProceedsInputFromFields({
      sale: "500000",
      mortgage: "200000",
      brokerageKind: "fixed",
      brokerageValue: "10000",
      taxA: "",
      taxB: "",
      penalty: "",
      legal: "1500",
      other: "",
    });
    assert.equal(direct.ok, true);
    if (!direct.ok) return;
    const moduleResult = calculateSaleProceeds(direct.input);
    assert.equal(moduleResult.ok, true);
    if (!moduleResult.ok) return;
    assert.equal(link.result.netProceedsCents, moduleResult.value.netProceedsCents);
    assert.equal(link.href.includes(email), false);
    assert.equal(link.href.includes("Personne"), false);
    assert.equal(link.href.includes("consentement"), false);
    assert.equal(JSON.stringify(link).includes(email), false);
    assert.equal(queryDropsPrivate(query), true);
    const html = renderToStaticMarkup(
      createElement(
        NetProceedsResult,
        { result: link.result, href: link.href },
        createElement(
          "form",
          null,
          createElement("input", { name: "name" }),
          createElement("input", { name: "email", type: "email" }),
          createElement("input", { name: "consent_respond", type: "checkbox", value: "on" }),
        ),
      ),
    );
    assert.equal(html.includes(netProceedsResultSentence(moduleResult.value.netProceedsCents)), true);
    assert.equal(html.includes(link.href.replaceAll("&", "&amp;")), true);
    assert.equal(html.includes(email), false);
    assert.equal(html.includes("consent_respond"), true);
    assert.equal(html.includes("checked"), false);
  });

  it("refuse un courtage illisible et n'écrit pas le texte reçu", () => {
    const link = readNetProceedsLink({ vente: "500000", courtage: "javascript", valeur: email });
    assert.equal(link.present, true);
    if (!link.present) return;
    assert.equal(link.ok, false);
    assert.equal(JSON.stringify(link).includes(email), false);
    assert.equal(JSON.stringify(link).includes("javascript"), false);
  });
});
