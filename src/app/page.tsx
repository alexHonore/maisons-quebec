import type { Metadata } from "next";
import { buildHomeContent, HOME_DESCRIPTION, HOME_TITLE } from "@/content/home";
import { readRegulatoryIdentity } from "@/domain/regulatory-identity";
import { readSiteUrl } from "@/domain/site-url";

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

function Mark() {
  return (
    <svg className="brand-mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#16342c" />
      <path d="M6 15.2 16 7l10 8.2" stroke="#f3efe6" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M9 14.2V24h14V14.2" stroke="#f3efe6" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 24v-5.5h4V24" stroke="#e2b56a" strokeWidth="1.6" />
    </svg>
  );
}

export default function Home() {
  const content = buildHomeContent(readRegulatoryIdentity(process.env));
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
    <>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <a className="brand" href="#contenu">
            <Mark />
            <span>
              <span className="brand-name">{content.brand}</span>
              <span className="brand-note">{content.brandNote}</span>
            </span>
          </a>
          <a className="status-chip" href="#identification">
            {content.identityStatus}
          </a>
        </div>
        <div className="wrap nav-row">
          <nav aria-label="Sections">
            <ul className="nav">
              {content.nav.map((item) => (
                <li key={item.href}>
                  <a href={item.href}>{item.label}</a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
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
              <a className="action" key={action.href + action.label} href={action.href}>
                <strong>{action.label}</strong>
                <span>{action.description}</span>
              </a>
            ))}
          </div>
        </div>

        <section id="outils">
          <div className="wrap panel">
            <h2>{content.tool.title}</h2>
            <p>{content.tool.body}</p>
          </div>
        </section>

        <section>
          <div className="wrap section-grid">
            <article id="vendre" className="panel">
              <h2>{content.sell.title}</h2>
              {content.sell.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </article>
            <article id="acheter" className="panel">
              <h2>{content.buy.title}</h2>
              {content.buy.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
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
            </article>
          </div>
        </section>

        <section id="identification">
          <div className="wrap panel">
            <h2>{content.identity.title}</h2>
            <p>{content.identity.intro}</p>
            <dl>
              {content.identity.fields.map((field) => (
                <div className="field" data-state={field.state} key={field.id}>
                  <dt>{field.label}</dt>
                  <dd>{field.display}</dd>
                </div>
              ))}
            </dl>
            <p>{content.identity.caveat}</p>
          </div>
        </section>
      </main>
      <footer className="site-footer">
        <div className="wrap">
          <ul>
            {content.footer.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replaceAll("<", "\\u003c") }}
      />
    </>
  );
}
