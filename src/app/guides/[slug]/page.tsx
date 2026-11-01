import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicFrame } from "@/components/public-frame";
import { ContentArticle } from "@/components/content-article";
import { readPublicContentPage } from "@/server/content-pages";
import { listPublishedPageMedia } from "@/server/media-library";
import { loadPublicSite, settingsDatabase } from "@/server/public-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const page = readPublicContentPage(settingsDatabase(process.env), slug);
  if (!page) return { title: "Page introuvable", robots: { index: false, follow: false } };
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: `/guides/${page.slug}` },
    robots: page.assessment.indexable ? { index: true, follow: true } : { index: false, follow: false },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const db = settingsDatabase(process.env);
  const page = readPublicContentPage(db, slug);
  if (!page) notFound();
  const { content } = loadPublicSite(process.env);
  return (
    <PublicFrame content={content}>
      <main id="contenu">
        <ContentArticle page={page} preview={false} media={listPublishedPageMedia(db, page.id)} />
      </main>
    </PublicFrame>
  );
}
