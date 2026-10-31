import type { MetadataRoute } from "next";
import { PILLAR_PAGES } from "@/content/pillars";
import { readSiteUrl } from "@/domain/site-url";

const CONTENT_DATE = "2026-10-31";

export default function sitemap(): MetadataRoute.Sitemap {
  const site = readSiteUrl(process.env);
  return [
    {
      url: new URL("/", site.origin).href,
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: new URL("/vendre/calculateur-produit-net", site.origin).href,
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly",
      priority: 0.8,
    },
    ...PILLAR_PAGES.map((page) => ({
      url: new URL(page.path, site.origin).href,
      lastModified: CONTENT_DATE,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
