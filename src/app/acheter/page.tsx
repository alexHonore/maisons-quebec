import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("acheter");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Acheter",
  description: page?.description,
  alternates: { canonical: "/acheter" },
};

export default function AcheterPage() {
  return <PillarView slug="acheter" />;
}
