import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("marche");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Marché",
  description: page?.description,
  alternates: { canonical: "/marche" },
};

export default function MarchePage() {
  return <PillarView slug="marche" />;
}
