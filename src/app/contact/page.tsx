import type { Metadata } from "next";
import { PillarView } from "@/components/pillar-view";
import { pillarBySlug } from "@/content/pillars";

const page = pillarBySlug("contact");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: page?.title ?? "Contact",
  description: page?.description,
  alternates: { canonical: "/contact" },
  robots: { index: true, follow: true },
};

export default function ContactPage() {
  return <PillarView slug="contact" />;
}
