import Script from "next/script";

/** Google Analytics 4 measurement ID (starts with G-). Off until it's set. */
const GA_ID = (process.env.NEXT_PUBLIC_GA_ID || "").trim();
const enabled = /^G-[A-Z0-9]+$/.test(GA_ID);

/** Google's standard gtag.js snippet, loaded after the page becomes interactive. */
export function GoogleAnalytics() {
  if (!enabled) return null;
  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
      <Script id="ga4" strategy="afterInteractive">
        {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA_ID}');`}
      </Script>
    </>
  );
}
