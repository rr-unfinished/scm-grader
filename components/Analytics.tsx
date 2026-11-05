import Script from "next/script";

import { GA_ENABLED as enabled, GA_ID } from "@/lib/site";

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
