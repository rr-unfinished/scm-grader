import { SiteFooter, SiteHeader } from "@/components/Chrome";

export default function ReportNotFound() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <section className="view" style={{ alignItems: "flex-start" }}>
          <h1 style={{ fontSize: "clamp(30px, 4vw, 44px)", letterSpacing: "-1px" }}>We couldn&apos;t find that report.</h1>
          <p className="lede" style={{ marginTop: 0 }}>
            The link may be incomplete. Check the link in your email, or run a new scan.
          </p>
          <a className="btn btn-primary" href="/" style={{ textDecoration: "none" }}>
            Grade my practice
          </a>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
