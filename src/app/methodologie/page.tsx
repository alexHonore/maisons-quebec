import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("methodologie");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Méthode",
  description: page?.description,
  alternates: { canonical: "/methodologie" },
};

export default function MethodologiePage() {
  return <PillarView slug="methodologie" />;
}
