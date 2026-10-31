import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("vendre");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Vendre",
  description: page?.description,
  alternates: { canonical: "/vendre" },
};

export default function VendrePage() {
  return <PillarView slug="vendre" />;
}
