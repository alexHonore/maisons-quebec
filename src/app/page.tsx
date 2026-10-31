import type { Metadata } from "next";
import Link from "next/link";
import { HOME_DESCRIPTION, HOME_TITLE } from "@/content/home";
import { PublicFrame } from "@/components/public-frame";
import { readSiteUrl } from "@/domain/site-url";
import { loadPublicSite } from "@/server/public-site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    url: "/",
    locale: "fr_CA",
    type: "website",
    siteName: "Maisons Québec",
  },
};

export default function Home() {
  const { content } = loadPublicSite(process.env);
  const site = readSiteUrl(process.env);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: content.brand,
    url: site.origin,
    inLanguage: "fr-CA",
    description: HOME_DESCRIPTION,
  };

  return (
    <PublicFrame content={content}>
      <main id="contenu">
        <div className="wrap hero">
          <div>
            <h1>{content.hero.title}</h1>
            <p className="lede">{content.hero.promise}</p>
            <p>{content.hero.subpromise}</p>
          </div>
          <aside className="limits" aria-label="Ce que cette page ne fait pas">
            <h2>Ce qui n&apos;est pas affiché</h2>
            <ul>
              {content.limits.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </aside>
        </div>
        <div className="wrap">
          <div className="actions">
            {content.hero.actions.map((action) => (
              <Link className="action" key={action.href + action.label} href={action.href}>
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </Link>
            ))}
          </div>
        </div>

        <section id="outils">
          <div className="wrap panel">
            <h2>{content.tool.title}</h2>
            <p>{content.tool.body}</p>
            <p>
              <Link href="/outils">Lire la page des outils</Link>
            </p>
          </div>
        </section>

        <section>
          <div className="wrap section-grid">
            <article id="vendre" className="panel">
              <h2>{content.sell.title}</h2>
              {content.sell.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p>
                <Link href="/vendre">Lire la page Vendre</Link>
              </p>
            </article>
            <article id="acheter" className="panel">
              <h2>{content.buy.title}</h2>
              {content.buy.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              <p>
                <Link href="/acheter">Lire la page Acheter</Link>
              </p>
            </article>
          </div>
        </section>

        <section id="marche">
          <div className="wrap">
            <h2>{content.market.title}</h2>
            <p>{content.market.body}</p>
            <ul className="place-list">
              {content.market.places.map((place) => (
                <li key={place.name}>
                  <span>{place.name}</span>
                  <span>{place.status}</span>
                </li>
              ))}
            </ul>
            <p>
              <Link href="/marche">Lire la page Marché</Link>
            </p>
          </div>
        </section>

        <section>
          <div className="wrap">
            <h2>{content.questions.title}</h2>
            <div className="questions">
              {content.questions.items.map((item) => (
                <article className="question" key={item.question}>
                  <h3>{item.question}</h3>
                  <p>{item.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="wrap two">
            <article className="panel">
              <h2>{content.scenarios.title}</h2>
              <p>{content.scenarios.intro}</p>
              <ul className="scenario-list">
                {content.scenarios.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </article>
            <article id="guides" className="panel">
              <h2>{content.guides.title}</h2>
              <p>{content.guides.body}</p>
              <p>
                <Link href="/guides">Lire la page Guides</Link>
              </p>
            </article>
          </div>
        </section>

        <section id="methode">
          <div className="wrap">
            <h2>{content.method.title}</h2>
            <ul className="plain-list">
              {content.method.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p>
              <Link href="/methodologie">Lire la page Méthode</Link>
            </p>
          </div>
        </section>

        <section>
          <div className="wrap two">
            <article className="panel">
              <h2>{content.proof.title}</h2>
              <p>{content.proof.body}</p>
            </article>
            <article id="contact" className="panel">
              <h2>{content.contact.title}</h2>
              <p>{content.contact.body}</p>
              <p>
                <Link href="/contact">Lire la page Contact</Link>
              </p>
            </article>
          </div>
        </section>
      </main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
    </PublicFrame>
  );
}
