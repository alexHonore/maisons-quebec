import type { ReactNode } from "react";
import Link from "next/link";
import { pillarBySlug, type PillarPage } from "@/content/pillars";
import { PublicFrame } from "@/components/public-frame";
import { loadPublicSite } from "@/server/public-site";

export function PillarView({ slug, children }: { slug: PillarPage["slug"]; children?: ReactNode }) {
  const page = pillarBySlug(slug);
  if (!page) return null;
  const { content } = loadPublicSite(process.env);
  return (
    <PublicFrame content={content}>
      <main id="contenu" className="wrap pillar">
        <h1>{page.title}</h1>
        <p className="lede">{page.lead}</p>
        {page.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        ))}
        <section>
          <h2>Ce qui manque</h2>
          <ul className="plain-list">
            {page.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
        {children}
        <ul className="nav">
          {page.links.map((link) => (
            <li key={link.href}>
              <Link href={link.href}>{link.label}</Link>
            </li>
          ))}
        </ul>
      </main>
    </PublicFrame>
  );
}
