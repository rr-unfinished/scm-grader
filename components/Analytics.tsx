import Script from "next/script";

/** Google Tag Manager container. Set NEXT_PUBLIC_GTM_ID to change it, or to "off" to disable. */
const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-5LZBN53Q";
const enabled = /^GTM-[A-Z0-9]+$/.test(GTM_ID);

/** Google's standard Tag Manager snippet, loaded after the page becomes interactive. */
export function GtmHead() {
  if (!enabled) return null;
  return (
    <Script id="gtm" strategy="afterInteractive">
      {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`}
    </Script>
  );
}

/** Tag Manager's fallback for visitors with JavaScript turned off. */
export function GtmNoScript() {
  if (!enabled) return null;
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
        title="Google Tag Manager"
      />
    </noscript>
  );
}
