/**
 * Sends grader events to Google Analytics 4 (gtag.js).
 * Never include names, emails or phone numbers here: they'd go to Google.
 * Events sent before gtag.js finishes loading are queued and sent once it does.
 */
import { GA_ENABLED } from "./site";

type Params = Record<string, string | number | boolean | undefined>;

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export function track(event: string, params: Params = {}) {
  if (typeof window === "undefined" || !GA_ENABLED) return;
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
