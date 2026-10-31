import Link from "next/link";
import { OFFICIAL_RATES_MISSING } from "@/domain/net-proceeds-form";
import { NET_PROCEEDS_OPENAPI_PATH } from "@/domain/openapi-produit-net";
import { FORMULA_STATEMENT, type SaleProceeds } from "@/domain/sale-proceeds";
import type { NetProceedsLinkFields } from "@/domain/net-proceeds-link";
import { calculateNetProceedsAction, requestFollowUpAction } from "@/app/vendre/calculateur-produit-net/actions";
import { NetProceedsResult } from "@/components/net-proceeds-result";

export function NetProceedsCalculator({
  result,
  draftId,
  fields,
  href,
  error,
  received,
}: {
  result: SaleProceeds | null;
  draftId: string | null;
  fields: NetProceedsLinkFields | null;
  href: string | null;
  error: string | null;
  received: boolean;
}) {
  return (
    <div className="wrap pillar">
      <h1>Combien resterait-il après la vente ?</h1>
      <p className="lede">
        Ce calcul est hypothétique. Il reprend la formule déjà testée et les montants que vous écrivez. Barèmes officiels de courtage et de taxes : {OFFICIAL_RATES_MISSING}.
      </p>
      <p>{FORMULA_STATEMENT.limit}</p>
      <p>Scénarios prudent et optimiste : {OFFICIAL_RATES_MISSING}. Cette page calcule seulement la saisie affichée.</p>
      <p>Un lien peut reprendre ces montants hypothétiques. Il ne contient ni nom, ni courriel, ni consentement.</p>
      {error === "saisie" ? <p role="alert">La saisie n&apos;a pas pu être calculée. Vérifiez les montants.</p> : null}
      {error === "consentement" ? <p role="alert">La demande n&apos;est pas enregistrée sans le consentement de réponse.</p> : null}
      {error === "contact" ? <p role="alert">Le nom ou le courriel n&apos;est pas utilisable. Rien n&apos;a été enregistré.</p> : null}
      {received ? (
        <p role="status">
          Votre demande de réponse est enregistrée. S&apos;il n&apos;y a pas de destination, ou si l&apos;envoi échoue, elle reste en attente. Elle n&apos;est pas perdue.
        </p>
      ) : null}
      <form className="form-grid panel" action={calculateNetProceedsAction}>
        <label>
          Prix de vente hypothétique, en dollars
          <input name="sale" inputMode="decimal" autoComplete="off" required defaultValue={fields?.vente ?? ""} />
        </label>
        <label>
          Solde hypothécaire, en dollars
          <input name="mortgage" inputMode="decimal" autoComplete="off" defaultValue={fields?.hypotheque ?? ""} />
        </label>
        <label>
          Courtage
          <select name="brokerage_kind" defaultValue={fields?.courtage === "taux" ? "rate" : "fixed"}>
            <option value="fixed">Montant fixe</option>
            <option value="rate">Taux que vous indiquez</option>
          </select>
        </label>
        <label>
          Valeur du courtage
          <input name="brokerage_value" inputMode="decimal" autoComplete="off" required defaultValue={fields?.valeur ?? ""} />
        </label>
        <label>
          Taxe sur honoraires A, pourcentage saisi
          <input name="tax_a" inputMode="decimal" autoComplete="off" placeholder={OFFICIAL_RATES_MISSING} defaultValue={fields?.taxe_a ?? ""} />
        </label>
        <label>
          Taxe sur honoraires B, pourcentage saisi
          <input name="tax_b" inputMode="decimal" autoComplete="off" placeholder={OFFICIAL_RATES_MISSING} defaultValue={fields?.taxe_b ?? ""} />
        </label>
        <label>
          Pénalité hypothécaire connue, en dollars
          <input name="penalty" inputMode="decimal" autoComplete="off" defaultValue={fields?.penalite ?? ""} />
        </label>
        <label>
          Frais légaux, en dollars
          <input name="legal" inputMode="decimal" autoComplete="off" defaultValue={fields?.legal ?? ""} />
        </label>
        <label>
          Autres dépenses, en dollars
          <input name="other" inputMode="decimal" autoComplete="off" defaultValue={fields?.autres ?? ""} />
        </label>
        <button type="submit">Calculer</button>
      </form>
      {result ? (
        <NetProceedsResult result={result} href={href} fields={fields}>
          <form className="form-grid" id="demande-reponse" action={requestFollowUpAction}>
            {draftId ? <input type="hidden" name="draft_id" value={draftId} /> : null}
            <p>Le rendez-vous n&apos;est pas ouvert. Cette demande enregistre seulement votre accord d&apos;être recontacté.</p>
            <label>
              Nom
              <input name="name" autoComplete="name" required />
            </label>
            <label>
              Courriel
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label>
              <span>
                <input name="consent_respond" type="checkbox" value="on" /> J&apos;accepte qu&apos;on me réponde au sujet de ce calcul.
              </span>
            </label>
            <label>
              <span>
                <input name="consent_marketing" type="checkbox" value="on" /> J&apos;accepte de recevoir des messages promotionnels. Cette case n&apos;est pas requise.
              </span>
            </label>
            <button type="submit">Enregistrer la demande</button>
          </form>
        </NetProceedsResult>
      ) : null}
      <p>
        <a href={NET_PROCEEDS_OPENAPI_PATH}>Description OpenAPI, lecture seule</a>
      </p>
      <p>
        <Link href="/vendre">Retour à Vendre</Link>
      </p>
    </div>
  );
}
