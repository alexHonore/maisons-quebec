import type { Metadata } from "next";
import Link from "next/link";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";
import { listPublishedGuides } from "@/server/content-pages";
import { settingsDatabase } from "@/server/public-site";

const page = pillarBySlug("guides");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Guides",
  description: page?.description,
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const published = listPublishedGuides(settingsDatabase(process.env));
  return (
    <PillarView slug="guides">
      <section>
        <h2>Pages publiées</h2>
        {published.length === 0 ? (
          <p>Aucune page publiée. Un brouillon n&apos;apparaît pas ici.</p>
        ) : (
          <ul className="plain-list">
            {published.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/guides/${guide.slug}`}>{guide.title}</Link>
                {guide.indexable ? " — indexable" : " — non indexée"}
              </li>
            ))}
          </ul>
        )}
      </section>
    </PillarView>
  );
}
