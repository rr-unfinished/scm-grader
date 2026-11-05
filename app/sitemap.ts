import type { MetadataRoute } from "next";

const SITE = (process.env.SITE_URL || "https://grader.southcoastmarketing.com").replace(/\/$/, "");

/** Public pages only. Saved reports (/r/...) are private links and stay out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
