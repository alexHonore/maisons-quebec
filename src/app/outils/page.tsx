import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("outils");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Outils",
  description: page?.description,
  alternates: { canonical: "/outils" },
};

export default function OutilsPage() {
  return <PillarView slug="outils" />;
}
