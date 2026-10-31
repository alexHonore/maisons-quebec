import type { MetadataRoute } from "next";
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
  ];
}
