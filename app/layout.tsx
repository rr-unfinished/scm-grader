import type { Metadata } from "next";
import "./globals.css";
import { GoogleAnalytics } from "@/components/Analytics";

const SITE = (process.env.SITE_URL || "https://grader.southcoastmarketing.com").replace(/\/$/, "");

const TITLE = "Free Dental & Medical Marketing Audit | South Bay, LA";
const DESCRIPTION =
  "Free marketing audit for dentists and medical practices in Torrance, Redondo Beach & the South Bay. See your Google, website, reviews and AI search score.";
const SHARE_TITLE = "Is your practice losing patients online? Get a free marketing score";
const SHARE_DESCRIPTION =
  "Free for South Bay dentists and medical practices. See how you rank on Google, how your website and reviews stack up, and whether ChatGPT recommends you.";
const SHARE_IMAGE = {
  url: "/og-image.png",
  width: 1200,
  height: 630,
  alt: "South Coast Marketing Practice Grader: a free digital marketing score for dentists and medical practices",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Google Search Console ownership check
  verification: { google: "LzyBDOtw3N6FX52I-tTvI3SCNJQwAS6Cl8uC5jMZMXo" },
  icons: { icon: "/logo-color.png", apple: "/logo-color.png" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "South Coast Marketing",
    locale: "en_US",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SHARE_TITLE,
    description: SHARE_DESCRIPTION,
    images: [SHARE_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
        />
      </head>
      <body>
        {children}
        <GoogleAnalytics />
      </body>
    </html>
  );
}
