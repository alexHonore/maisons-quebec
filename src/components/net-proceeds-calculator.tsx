import Link from "next/link";
import { OFFICIAL_RATES_MISSING } from "@/domain/net-proceeds-form";
import { FORMULA_STATEMENT, type SaleProceeds } from "@/domain/sale-proceeds";
import { calculateNetProceedsAction, requestFollowUpAction } from "@/app/vendre/calculateur-produit-net/actions";

function formatCadCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const absolute = Math.abs(cents);
  const dollars = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");
  const grouped = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
  return `${sign}${grouped},${fraction} CAD`;
}

export function NetProceedsCalculator({
  result,
  draftId,
  error,
  received,
}: {
  result: SaleProceeds | null;
  draftId: string | null;
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
          <input name="sale" inputMode="decimal" autoComplete="off" required />
        </label>
        <label>
          Solde hypothécaire, en dollars
          <input name="mortgage" inputMode="decimal" autoComplete="off" />
        </label>
        <label>
          Courtage
          <select name="brokerage_kind" defaultValue="fixed">
            <option value="fixed">Montant fixe</option>
            <option value="rate">Taux que vous indiquez</option>
          </select>
        </label>
        <label>
          Valeur du courtage
          <input name="brokerage_value" inputMode="decimal" autoComplete="off" required />
        </label>
        <label>
          Taxe sur honoraires A, pourcentage saisi
          <input name="tax_a" inputMode="decimal" autoComplete="off" placeholder={OFFICIAL_RATES_MISSING} />
        </label>
        <label>
          Taxe sur honoraires B, pourcentage saisi
          <input name="tax_b" inputMode="decimal" autoComplete="off" placeholder={OFFICIAL_RATES_MISSING} />
        </label>
        <label>
          Pénalité hypothécaire connue, en dollars
          <input name="penalty" inputMode="decimal" autoComplete="off" />
        </label>
        <label>
          Frais légaux, en dollars
          <input name="legal" inputMode="decimal" autoComplete="off" />
        </label>
        <label>
          Autres dépenses, en dollars
          <input name="other" inputMode="decimal" autoComplete="off" />
        </label>
        <button type="submit">Calculer</button>
      </form>
      {result && draftId ? (
        <section className="panel">
          <h2>Résultat hypothétique</h2>
          <p>Produit net : {formatCadCents(result.netProceedsCents)}</p>
          <ul className="plain-list">
            {result.lines.map((line) => (
              <li key={line.code}>
                {line.label}
                {line.amountCents === null ? " — exclu" : ` — ${formatCadCents(line.amountCents)}`}
                . {line.note}
              </li>
            ))}
          </ul>
          {result.warningCodes.includes("no_tax_on_brokerage") ? (
            <p>Taxes officielles : {OFFICIAL_RATES_MISSING}. Aucune taxe n&apos;a été ajoutée.</p>
          ) : null}
          <h2>Demander une réponse</h2>
          <p>Le rendez-vous n&apos;est pas ouvert. Cette demande enregistre seulement votre accord d&apos;être recontacté.</p>
          <form className="form-grid" action={requestFollowUpAction}>
            <input type="hidden" name="draft_id" value={draftId} />
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
        </section>
      ) : null}
      <p>
        <Link href="/vendre">Retour à Vendre</Link>
      </p>
    </div>
  );
}
