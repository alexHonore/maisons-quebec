import type { ReactNode } from "react";
import { OFFICIAL_RATES_MISSING } from "@/domain/net-proceeds-form";
import { formatCadCents, NET_PROCEEDS_LINK_KEYS, netProceedsResultSentence, type NetProceedsLinkFields } from "@/domain/net-proceeds-link";
import type { SaleProceeds } from "@/domain/sale-proceeds";

export function NetProceedsResult({
  result,
  href,
  fields,
  children,
}: {
  result: SaleProceeds;
  href?: string | null;
  fields?: NetProceedsLinkFields | null;
  children?: ReactNode;
}) {
  return (
    <section className="panel">
      <h2>Résultat hypothétique</h2>
      <p>{netProceedsResultSentence(result.netProceedsCents)}</p>
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
      {href ? (
        <p>
          Lien de ce calcul : <a href={href}>{href}</a>
        </p>
      ) : null}
      <h2>Demander une réponse</h2>
      <p>Le formulaire vient après le résultat. La demande n&apos;est pas enregistrée sans le consentement de réponse.</p>
      {fields
        ? NET_PROCEEDS_LINK_KEYS.map((key) => <input key={key} type="hidden" name={key} value={fields[key]} form="demande-reponse" />)
        : null}
      {children}
    </section>
  );
}
