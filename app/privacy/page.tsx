import type { Metadata } from "next";
import { SiteFooter, SiteHeader } from "@/components/Chrome";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy policy | South Coast Marketing",
  description: "How South Coast Marketing handles information collected through the Practice Grader.",
};

const UPDATED = "November 3, 2026";

export default function Privacy() {
  return (
    <>
      <SiteHeader />
      <main className="wrap">
        <article className="legal">
          <p className="eyebrow">Practice Grader</p>
          <h1>Privacy policy</h1>
          <p className="updated">Last updated {UPDATED}</p>

          <p>
            This policy explains what South Coast Marketing collects when you use the Practice Grader, how we use it, and
            the choices you have. If you have questions, email us at <b>{CONTACT_EMAIL}</b>.
          </p>

          <h2>What we collect</h2>
          <p>
            <b>What you tell us:</b> your first and last name, your role, your email address, your mobile number, and the
            practice you want graded, including its type and city.
          </p>
          <p>
            <b>Public information about your practice:</b> to build your report we look up your practice&apos;s public
            Google listing (category, hours, photos, rating and review count), nearby practices&apos; public listings, your
            public website, and how AI assistants such as ChatGPT answer questions about practices in your area.
          </p>
          <p>
            <b>Basic technical information:</b> to prevent abuse we keep a one-way, scrambled code made from your IP address.
            We don&apos;t store the IP address itself. Our hosting provider also keeps standard server logs.
          </p>
          <p>
            The grader is about your practice&apos;s online presence. Please don&apos;t enter any patient information.
          </p>

          <h2>How we use it</h2>
          <ul>
            <li>To create your report and send it to you by email.</li>
            <li>To contact you about your report, including by phone, text or email, and to follow up if you ask for a call.</li>
            <li>To keep track of our conversations with you in our customer records.</li>
            <li>To limit how many scans can be run, so the tool stays available and isn&apos;t misused.</li>
          </ul>

          <h2>Calls, texts and email</h2>
          <p>
            By submitting the form you agree that South Coast Marketing may contact you about your report at the email and
            phone number you gave, including by text. Message and data rates may apply. You can reply STOP to any text to
            stop texts, unsubscribe from any email, or ask us to stop contacting you at {CONTACT_EMAIL}. Agreeing to be
            contacted is not a condition of buying anything.
          </p>

          <h2>Who handles your information</h2>
          <p>We don&apos;t sell your personal information. We use these service providers to run the grader:</p>
          <ul>
            <li><b>Vercel</b> hosts the website.</li>
            <li><b>Supabase</b> stores your submission and report.</li>
            <li><b>Resend</b> sends our emails.</li>
            <li><b>Attio</b> holds our customer records.</li>
            <li><b>Google</b> provides practice listings and website speed results.</li>
            <li><b>OpenAI</b> answers the AI search questions. We send it only your practice type and city, never your name, email or phone.</li>
            <li><b>Cloudflare</b> checks that visitors aren&apos;t bots.</li>
          </ul>
          <p>
            We may also share information if the law requires it, or as part of a sale or merger of our business.
          </p>

          <h2>Your report link</h2>
          <p>
            Each report has a private link that isn&apos;t listed in search engines. Anyone you share the link with can see
            the report, so share it only with people you trust. Your contact details aren&apos;t shown on the report.
          </p>

          <h2>How long we keep it</h2>
          <p>
            We keep your submission and report while we may be working with you, and for up to three years after our last
            contact, unless you ask us to delete it sooner.
          </p>

          <h2>Your choices</h2>
          <p>
            You can ask us to show you the information we have about you, correct it, or delete it by emailing{" "}
            {CONTACT_EMAIL}. California residents may have additional rights under California law, including the right to
            know, delete and correct personal information, and not to be treated differently for using these rights. We
            will verify requests before acting on them.
          </p>

          <h2>Children</h2>
          <p>The Practice Grader is meant for businesses and isn&apos;t directed to children under 16.</p>

          <h2>Changes</h2>
          <p>If we change this policy, we&apos;ll update the date at the top of this page.</p>
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
