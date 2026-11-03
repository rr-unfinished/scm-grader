/* eslint-disable @next/next/no-img-element */
import { CONTACT_EMAIL, CONTACT_PHONE } from "@/lib/site";
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
        <div className="fb">
          <img src="/logo-white.png" alt="" />
          <div>
            <b>South Coast Marketing</b>
            <span>Get found. Get chosen.</span>
          </div>
        </div>
        <div className="fl">
          <span>Serving the South Bay</span>
          <span>{CONTACT_PHONE}</span>
          <span>{CONTACT_EMAIL}</span>
          <a href="/privacy">Privacy policy</a>
        </div>
      </div>
    </footer>
  );
}
