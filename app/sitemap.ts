import type { MetadataRoute } from "next";
import { citySlug } from "@/lib/cities";
import { SOUTH_BAY_CITIES } from "@/lib/practice-types";

const SITE = (process.env.SITE_URL || "https://grader.southcoastmarketing.com").replace(/\/$/, "");

/** Public pages only. Saved reports (/r/...) are private links and stay out. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${SITE}/`, changeFrequency: "monthly", priority: 1 },
    ...SOUTH_BAY_CITIES.map((c) => ({
      url: `${SITE}/${citySlug(c)}`,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    { url: `${SITE}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
