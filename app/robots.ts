import type { MetadataRoute } from "next";

const SITE = (process.env.SITE_URL || "https://grader.southcoastmarketing.com").replace(/\/$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    // Reports aren't blocked here on purpose: crawlers need to reach them to see
    // their "noindex" tag. They're never linked publicly or listed in the sitemap.
    rules: [{ userAgent: "*", allow: "/", disallow: "/api/" }],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
