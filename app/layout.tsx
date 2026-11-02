import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Practice Grader | South Coast Marketing",
  description:
    "Enter your practice name and get your online health score in under a minute. Free for South Bay dental and medical practices.",
  icons: { icon: "/logo-color.png" },
  openGraph: {
    title: "Practice Grader | South Coast Marketing",
    description: "See how patients find your practice online. Free score in under a minute.",
    images: ["/logo-color.png"],
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
      <body>{children}</body>
    </html>
  );
}
