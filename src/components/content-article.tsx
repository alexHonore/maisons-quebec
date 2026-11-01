import { indexReasonLabel, type ContentAssessment } from "@/domain/content-page";

export function ContentArticle({
  page,
  preview,
  media,
}: {
  page: {
    readonly title: string;
    readonly description: string;
    readonly body: string;
    readonly sourceNote: string;
    readonly example: boolean;
    readonly assessment: ContentAssessment;
  };
  preview: boolean;
  media?: readonly {
    readonly id: string;
    readonly title: string;
    readonly author: string;
    readonly license: string;
    readonly source: string;
  }[];
}) {
  return (
    <article className="wrap pillar">
      {preview ? (
        <p role="status">
          Aperçu privé. {page.assessment.visible ? "Le public voit cette page." : "Le public ne voit pas ce brouillon."} {indexReasonLabel(page.assessment.reason)}.
        </p>
      ) : null}
      {page.example ? <p>Exemple de rédaction. Ce texte n&apos;est pas un fait de marché.</p> : null}
      {page.assessment.reason === "unsourced_market_claim" ? (
        <p>Ce texte cite un prix, un taux ou un décompte sans source nommée. Il n&apos;est pas une donnée de marché vérifiée.</p>
      ) : (
        <p>Cette page n&apos;est pas une statistique de marché publiée par le site.</p>
      )}
      <h1>{page.title}</h1>
      <p className="lede">{page.description}</p>
      {page.body.split(/\n{2,}/).map((paragraph) => (
        <p key={paragraph}>{paragraph}</p>
      ))}
      <p>Source déclarée : {page.sourceNote === "" ? "aucune" : page.sourceNote}</p>
      {media?.map((item) => (
        <figure key={item.id}>
          {/* Fichier local servi par /medias. Pas d'optimiseur qui irait chercher une image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/medias/${item.id}`} alt={item.title} />
          <figcaption>{item.author} — {item.license} — {item.source}</figcaption>
        </figure>
      ))}
    </article>
  );
}
