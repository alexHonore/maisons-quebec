import Link from "next/link";
import type { HomeContent } from "@/content/home";
import type { ReactNode } from "react";

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

export function PublicFrame({ content, children }: { content: HomeContent; children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#contenu">
        Aller au contenu
      </a>
      <header className="site-header">
        <div className="wrap header-row">
          <Link className="brand" href="/">
            <Mark />
            <span>
              <span className="brand-name">{content.brand}</span>
              <span className="brand-note">{content.brandNote}</span>
            </span>
          </Link>
          <a className="status-chip" href="#identification">
            {content.identityStatus}
          </a>
        </div>
        <div className="wrap nav-row">
          <nav aria-label="Sections">
            <ul className="nav">
              {content.nav.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>
      {children}
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
      <footer className="site-footer">
        <div className="wrap">
          <span className="brand-name">{content.brand}</span>
          <ul>
            {content.footer.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </footer>
    </>
  );
}
