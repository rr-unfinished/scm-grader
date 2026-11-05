/**
 * Sends grader events to Google Analytics 4 (gtag.js).
 * Never include names, emails or phone numbers here: they'd go to Google.
 * Events sent before gtag.js finishes loading are queued and sent once it does.
 */
type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined" || !process.env.NEXT_PUBLIC_GA_ID) return;
  if (window.gtag) {
    window.gtag("event", event, params);
    return;
  }
  // gtag.js reads queued calls from dataLayer as "arguments" objects.
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  (function queue(..._args: unknown[]) {
    window.dataLayer!.push(arguments);
  })("event", event, params);
}
