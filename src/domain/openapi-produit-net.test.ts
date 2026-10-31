import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { NET_PROCEEDS_LINK_KEYS, readNetProceedsLink } from "./net-proceeds-link";
import { netProceedsInputFromFields } from "./net-proceeds-form";
import { buildNetProceedsOpenApi, publicUnauthenticatedLeadPosts } from "./openapi-produit-net";
import { calculateSaleProceeds } from "./sale-proceeds";

describe("OpenAPI du produit net", () => {
  it("décrit seulement le GET du calcul, et ce calcul égale le module", () => {
    const document = buildNetProceedsOpenApi();
    assert.equal(document.openapi, "3.1.0");
    const operation = document.paths["/vendre/calculateur-produit-net"];
    assert.ok(operation?.get);
    assert.equal(operation?.post, undefined);
    assert.deepEqual(
      operation?.parameters?.map((parameter) => parameter.name),
      [...NET_PROCEEDS_LINK_KEYS],
    );
    assert.deepEqual(publicUnauthenticatedLeadPosts(document), []);
    assert.deepEqual(publicUnauthenticatedLeadPosts({
      ...document,
      paths: {
        ...document.paths,
        "/leads": { post: { operationId: "createLead" } },
      },
    }), ["/leads"]);
    const example = { vente: "500000", hypotheque: "200000", courtage: "fixe", valeur: "10000" };
    const link = readNetProceedsLink(example);
    const direct = netProceedsInputFromFields({
      sale: example.vente,
      mortgage: example.hypotheque,
      brokerageKind: "fixed",
      brokerageValue: example.valeur,
      taxA: "",
      taxB: "",
      penalty: "",
      legal: "",
      other: "",
    });
    assert.equal(link.present && link.ok, true);
    assert.equal(direct.ok, true);
    if (!link.present || !link.ok || !direct.ok) return;
    const moduleResult = calculateSaleProceeds(direct.input);
    assert.equal(moduleResult.ok, true);
    if (!moduleResult.ok) return;
    assert.equal(link.result.netProceedsCents, moduleResult.value.netProceedsCents);
    assert.equal(JSON.stringify(document).includes("@"), false);
  });
});
