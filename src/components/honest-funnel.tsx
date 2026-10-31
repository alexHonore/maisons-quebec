import { REGULATORY_EMPTY_LABEL } from "@/domain/regulatory-identity";
import {
  BEDROOM_BANDS,
  CONDITION_BANDS,
  COST_FOCI,
  FUNNEL_TITLES,
  HORIZONS,
  PLACE_TYPES,
  PREP_TASKS,
  PROPERTY_TYPES,
  PROXIMITIES,
  SCENARIOS,
  SETTINGS,
  SURFACE_BANDS,
  YEAR_BANDS,
  type HonestFunnelName,
  type HonestResult,
} from "@/domain/honest-funnels";
import { requestHonestFollowUpAction, saveHonestFunnelAction } from "@/server/honest-actions";

const LEDES: Record<HonestFunnelName, string> = {
  estimation_maison:
    "Ce rapport reprend ce que vous décrivez. Il ne donne pas de prix : aucune vente comparable n'est branchée.",
  vendre_avant_acheter:
    "Trois ordres possibles, en mots. Aucun financement n'est calculé et aucune approbation de crédit n'est donnée.",
  comparer_quartiers:
    "Le résultat note vos préférences. Il ne nomme aucun quartier et n'affiche aucun logement.",
  cout_total_achat:
    "Les frais uniques et les frais récurrents sont séparés. Le taux, la taxe de bienvenue et la mensualité ne sont pas calculés.",
  preparer_sa_maison:
    "Cochez ce qui est déjà fait. Le décompte n'est pas une note de qualité certifiée.",
};

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly (readonly [string, string])[];
}) {
  return (
    <label>
      {label}
      <select name={name} required defaultValue="">
        <option value="" disabled>
          Choisir
        </option>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
}

function FunnelFields({ funnel }: { funnel: HonestFunnelName }) {
  if (funnel === "estimation_maison") {
    return (
      <>
        <label>
          Municipalité, sans numéro d&apos;adresse
          <input name="municipality" autoComplete="address-level2" required />
        </label>
        <SelectField name="property_type" label="Type de bien" options={PROPERTY_TYPES} />
        <SelectField name="year_band" label="Période de construction" options={YEAR_BANDS} />
        <SelectField name="surface_band" label="Surface, selon vous" options={SURFACE_BANDS} />
        <SelectField name="bedrooms" label="Chambres" options={BEDROOM_BANDS} />
        <SelectField name="condition" label="Entretien" options={CONDITION_BANDS} />
      </>
    );
  }
  if (funnel === "vendre_avant_acheter") {
    return (
      <>
        <SelectField name="scenario" label="Scénario" options={SCENARIOS} />
        <SelectField name="horizon" label="Horizon" options={HORIZONS} />
      </>
    );
  }
  if (funnel === "comparer_quartiers") {
    return (
      <>
        <SelectField name="setting" label="Milieu recherché" options={SETTINGS} />
        <SelectField name="property_type" label="Type de bien" options={PLACE_TYPES} />
        <SelectField name="transport" label="Transport" options={PROXIMITIES} />
        <SelectField name="schools" label="École à proximité, comme caractéristique du lieu" options={PROXIMITIES} />
        <SelectField name="shops" label="Commerces" options={PROXIMITIES} />
        <SelectField name="parks" label="Parcs" options={PROXIMITIES} />
      </>
    );
  }
  if (funnel === "cout_total_achat") {
    return <SelectField name="focus" label="Ce que vous voulez clarifier" options={COST_FOCI} />;
  }
  return (
    <fieldset>
      <legend>Tâches déjà faites</legend>
      {PREP_TASKS.map(([value, label]) => (
        <label key={value}>
          <span>
            <input name="tasks" type="checkbox" value={value} /> {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function HonestFunnelScreen({
  funnel,
  result,
  draftId,
  error,
  received,
  duplicate,
  missingResult,
}: {
  funnel: HonestFunnelName;
  result: HonestResult | null;
  draftId: string | null;
  error: string | null;
  received: boolean;
  duplicate: boolean;
  missingResult: boolean;
}) {
  return (
    <div className="wrap pillar">
      <h1>{FUNNEL_TITLES[funnel]}</h1>
      <p className="lede">{LEDES[funnel]}</p>
      <p>Donnée manquante : {REGULATORY_EMPTY_LABEL}.</p>
      {error === "saisie" ? <p role="alert">La saisie ne permet pas de préparer ce résultat.</p> : null}
      {error === "consentement" ? <p role="alert">La demande n&apos;est pas enregistrée sans le consentement de réponse.</p> : null}
      {error === "contact" ? <p role="alert">Le nom ou le courriel n&apos;est pas utilisable. Rien n&apos;a été enregistré.</p> : null}
      {error === "creneau" ? (
        <p role="alert">La plage souhaitée manque, ou elle contient un courriel. La demande n&apos;est pas enregistrée.</p>
      ) : null}
      {missingResult ? <p role="alert">Ce résultat n&apos;est pas disponible.</p> : null}
      {received ? (
        <p role="status">
          {duplicate
            ? "Une demande existe déjà pour ce courriel sur cet outil. Le nom, le consentement et le rendez-vous déjà enregistrés n'ont pas été changés."
            : "Votre demande de réponse est enregistrée. S'il n'y a pas de destination, ou si l'envoi échoue, elle reste en attente. Un rendez-vous demandé n'est pas un créneau confirmé."}
        </p>
      ) : null}
      <form className="form-grid panel" action={saveHonestFunnelAction}>
        <input type="hidden" name="funnel" value={funnel} />
        <FunnelFields funnel={funnel} />
        <button type="submit">Voir le résultat</button>
      </form>
      {result && draftId ? (
        <section className="panel">
          <h2>{result.title}</h2>
          <p>{result.summary}</p>
          <ul className="plain-list">
            {result.lines.map((line) => (
              <li key={line.label}>
                {line.label} — {line.value}
              </li>
            ))}
          </ul>
          <ul className="plain-list">
            {result.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p>{result.caveat}</p>
          <h2>Demander une réponse</h2>
          <p>Le rendez-vous est facultatif. Le demander ne confirme aucun créneau.</p>
          <form className="form-grid" action={requestHonestFollowUpAction}>
            <input type="hidden" name="funnel" value={funnel} />
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
                <input name="consent_respond" type="checkbox" value="on" /> J&apos;accepte qu&apos;on me réponde au sujet de ce résultat.
              </span>
            </label>
            <label>
              <span>
                <input name="consent_marketing" type="checkbox" value="on" /> J&apos;accepte de recevoir des messages promotionnels. Cette case n&apos;est pas requise.
              </span>
            </label>
            <label>
              <span>
                <input name="appointment" type="checkbox" value="on" /> Je demande un rendez-vous. Cela ne confirme pas un créneau.
              </span>
            </label>
            <label>
              Plage souhaitée, si vous demandez un rendez-vous
              <input name="appointment_window" autoComplete="off" />
            </label>
            <button type="submit">Enregistrer la demande</button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
