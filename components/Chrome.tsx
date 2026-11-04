/* eslint-disable @next/next/no-img-element */
import { CONTACT_EMAIL, CONTACT_EMAIL_HREF, CONTACT_PHONE, CONTACT_PHONE_HREF } from "@/lib/site";
export function SiteHeader() {
  return (
    <header className="top">
      <div className="wrap">
        <a className="brand" href="/">
          <img src="/logo-color.png" alt="" />
          <span className="wm">
            <b>South Coast</b>
            <span>MARKETING</span>
          </span>
        </a>
        <span className="pill">Practice Grader</span>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer>
      <div className="wrap">
        <a className="fb" href="/" aria-label="South Coast Marketing home">
          <img src="/logo-white.png" alt="" />
          <span className="wm">
            <b>South Coast</b>
            <span>MARKETING</span>
          </span>
        </a>
        <div className="fl">
          {CONTACT_PHONE_HREF ? <a href={CONTACT_PHONE_HREF}>{CONTACT_PHONE}</a> : <span>{CONTACT_PHONE}</span>}
          {CONTACT_EMAIL_HREF ? <a href={CONTACT_EMAIL_HREF}>{CONTACT_EMAIL}</a> : <span>{CONTACT_EMAIL}</span>}
          <a href="/privacy">Privacy policy</a>
        </div>
      </div>
    </footer>
  );
}
