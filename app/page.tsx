import Grader from "@/components/Grader";
import { SiteFooter, SiteHeader } from "@/components/Chrome";
import { homeSchema } from "@/lib/schema";

export default function Home() {
  // "<" is escaped so the JSON can't close the script tag early.
  const jsonLd = JSON.stringify(homeSchema()).replace(/</g, "\\u003c");
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
      <SiteHeader />
      <main className="wrap">
        <Grader />
      </main>
      <SiteFooter />
    </>
  );
}
