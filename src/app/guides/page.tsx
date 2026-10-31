import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("guides");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Guides",
  description: page?.description,
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return <PillarView slug="guides" />;
}
