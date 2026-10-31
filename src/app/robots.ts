import type { MetadataRoute } from "next";
import { readSiteUrl } from "@/domain/site-url";

export default function robots(): MetadataRoute.Robots {
  const site = readSiteUrl(process.env);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: "/admin",
    },
    sitemap: new URL("/sitemap.xml", site.origin).href,
    host: site.host,
  };
}
