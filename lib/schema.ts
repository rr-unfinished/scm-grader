/**
 * Structured data (schema.org JSON-LD) for the grader's home page.
 * Only facts we know are included: no street address, ratings or reviews,
 * which Google penalizes when they aren't real and visible on the page.
 */
import { SOUTH_BAY_CITIES } from "./practice-types";

const SITE = (process.env.SITE_URL || "https://grader.southcoastmarketing.com").replace(/\/$/, "");
const MAIN_SITE = "https://www.southcoastmarketing.com";
const clean = (v?: string) => (v ?? "").replace(/[^\x21-\x7E]/g, "");

export function homeSchema() {
  const email = clean(process.env.NEXT_PUBLIC_CONTACT_EMAIL);
  const digits = clean(process.env.NEXT_PUBLIC_CONTACT_PHONE).replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
  const phone = digits.length === 10 ? `+1-${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}` : undefined;
  const orgId = `${MAIN_SITE}/#organization`;

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: "South Coast Marketing",
        url: MAIN_SITE,
        logo: { "@type": "ImageObject", url: `${SITE}/logo-color.png` },
        description:
          "Digital marketing for South Bay dentists and medical practices: websites, local SEO, AI search visibility and paid ads.",
        ...(email ? { email } : {}),
        ...(phone ? { telephone: phone } : {}),
        ...(email || phone
          ? {
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "sales",
                areaServed: "US",
                availableLanguage: "English",
                ...(email ? { email } : {}),
                ...(phone ? { telephone: phone } : {}),
              },
            }
          : {}),
        areaServed: SOUTH_BAY_CITIES.map((city) => ({
          "@type": "City",
          name: `${city}, CA`,
        })),
        knowsAbout: [
          "Dental marketing",
          "Medical practice marketing",
          "Local SEO",
          "Google Business Profile optimization",
          "Generative engine optimization",
          "Pay-per-click advertising",
          "Website design",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE}/#website`,
        url: SITE,
        name: "South Coast Marketing Practice Grader",
        inLanguage: "en-US",
        publisher: { "@id": orgId },
      },
      {
        "@type": "WebApplication",
        "@id": `${SITE}/#grader`,
        name: "Practice Grader",
        url: SITE,
        description:
          "Free digital marketing audit for dentists and medical practices. Scores your Google ranking, website, reviews and AI search visibility in under a minute.",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        audience: {
          "@type": "BusinessAudience",
          audienceType: "Dental practices, orthodontists, medical clinics, chiropractors, med spas and physical therapy practices",
        },
        featureList: [
          "Google map rank for local searches",
          "Google Business Profile checks",
          "Mobile website speed",
          "Online booking and tap-to-call checks",
          "Google rating and review count",
          "ChatGPT recommendation check",
          "Structured data and FAQ checks",
        ],
        provider: { "@id": orgId },
        publisher: { "@id": orgId },
      },
    ],
  };
}
