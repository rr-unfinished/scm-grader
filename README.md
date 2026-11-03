# South Coast Marketing Practice Grader

A free online health score for South Bay dental and medical practices. A practice enters its name, answers three short questions, and gets a score out of 100 across Google search, website, reviews and AI search. That report is the lead magnet that books free audit calls.

## Status

**Stage 5: complete.** Every lead is saved with its report, gets a private report link and an email, and South Coast Marketing is notified. Every check in a live report uses real data. Google AI Overviews is not checked, because Google offers no API for it; adding it would need a paid search-results tool such as SerpApi or DataForSEO.

Without `GOOGLE_PLACES_API_KEY` the app falls back to sample data for everything, so it still runs locally with no keys.

| Stage | What it adds | Status |
| --- | --- | --- |
| 1 | App, screens, sample data, `/api/grade` endpoint | Done |
| 2 | Live Google data: Places autocomplete, map rank, rating, reviews, competitors | Done |
| 3 | PageSpeed mobile speed and website checks (tap-to-call, booking, schema) | Done |
| 4 | ChatGPT recommendation check | Done |
| 5 | Save leads (Supabase), email the report (Resend), notify South Coast | Done |
| 6 | Bot protection (Turnstile), scan reuse and limits, privacy page | Done |

## Leads and email setup

1. **Supabase:** open your project's **SQL Editor**, paste `supabase/schema.sql`, and click **Run**. Then copy the **Project URL** and a **secret key** (Project Settings → API Keys).
2. **Resend:** create an API key. To email prospects, add and verify your domain (Domains → Add domain, then add the DNS records it shows at your domain registrar). Until the domain is verified, Resend only delivers to your own Resend account address.
3. **Vercel → Settings → Environment Variables:**

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Supabase Project URL, like `https://abcd.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (server only) |
| `RESEND_API_KEY` | Resend API key |
| `RESEND_FROM` | Sender on your verified domain, like `South Coast Marketing <reports@southcoastmarketing.com>` |
| `LEAD_NOTIFY_EMAIL` | Where new-lead and call-request emails go |
| `SITE_URL` | Optional. Public address used in email links, like `https://grader.southcoastmarketing.com` |

Leads live in the Supabase **Table Editor → leads**. Rows include contact info, the full report, and `wants_call_at` when someone clicked "Book my free audit call". If a scan fails, the lead is still saved with `scan_error`.

## Attio CRM

With `ATTIO_API_KEY` set, every lead is sent to Attio after the scan:

- **Company:** the practice, matched on its website domain (or the lead's work email domain), so repeat scans update the same company.
- **Person:** matched on email, with name, role as job title, phone, and a link to the company.
- **Note on the person:** score, category scores, top 5 fixes, Google map rank and the report link.
- **Call request:** clicking "Book my free audit call" adds a second note, once, and moves the list entry to Call requested.
- **List (optional):** with `ATTIO_LIST` set, each person is added to that list at stage New with their score and report link. A repeat scan updates the score and link but leaves the stage alone, so it never undoes your pipeline moves.

To set it up, in Attio go to **Workspace settings → Developers → Access tokens**, create a token named `scm-grader` with these scopes, and add it in Vercel as `ATTIO_API_KEY`:

| Scope | Access |
| --- | --- |
| Records (`record_permission`) | Read-write |
| Object configuration (`object_configuration`) | Read |
| Notes (`note`) | Read-write |
| List entries (`list_entry`) | Read-write |
| List configuration (`list_configuration`) | Read |

For the list, create a **People** list (for example "Practice Grader Leads") and copy its API slug from the list's settings into `ATTIO_LIST`. The app reads the list's columns and fills any of these it finds, matched by name (capitals and spacing don't matter). Columns that don't exist are skipped.

| Column | Type | Filled with | Updated on rescan |
| --- | --- | --- | --- |
| Stage | Status, with `New` and `Call requested` | `New` when added; `Call requested` on a call click | No |
| Score | Number | Overall score out of 100 | Yes |
| Report link | Text | Saved report URL | Yes |
| Practice type | Select: Dental, Orthodontics, Medical clinic, Chiropractic, Med spa, Physical therapy | From the quiz | Yes |
| City | Select, with the 16 South Bay cities | City searched from | Yes |
| Google map rank | Number | Map position; empty if outside the top 20 | Yes |
| Google search score | Number | Out of 25 | Yes |
| Website score | Number | Out of 25; empty if the site blocked the scan | Yes |
| Reviews score | Number | Out of 25 | Yes |
| AI search score | Number | Out of 25; empty if not measured | Yes |
| Last scanned | Date | Date of the latest scan (Pacific time) | Yes |
| Call requested on | Date | Date of the call click | No |

Select options must match the names above exactly. If Attio rejects a value, the rest still save and the rejected column is logged in Vercel.

If Attio is down or rejects a request, the lead is still saved in Supabase and the emails still go out; the error is logged in Vercel.

## Cost protection (stage 6)

- **Scan reuse:** a practice scanned in the last 24 hours (same Google listing, practice type and city) reuses that report, so there are no new Google, PageSpeed or OpenAI charges. A new lead is still saved and emailed.
- **Scan limits:** 5 scans per visitor per hour, 15 per day, and 300 across everyone per day. Visitors are counted by a salted one-way hash of their IP; raw IPs are never stored. Change with `SCAN_LIMIT_HOUR`, `SCAN_LIMIT_DAY`, `SCAN_LIMIT_GLOBAL_DAY` and `SCAN_REUSE_HOURS`.
- **Bot check:** Cloudflare Turnstile on the last quiz step, verified on the server before any scan. Off until both keys are set. Usually invisible; shows a checkbox only when Cloudflare is unsure.
- **Privacy policy** at `/privacy`, linked from the consent text and the footer.

Setup:

1. **Supabase:** run the "Stage 6" lines at the bottom of `supabase/schema.sql` in the SQL Editor. Until then, leads still save but per-visitor limits can't count.
2. **Cloudflare:** dashboard → **Turnstile** → **Add widget**. Name it `scm-grader`, add your grader's hostname (for example `scm-grader.vercel.app`), mode **Managed**. Copy both keys.
3. **Vercel:** add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (site key) and `TURNSTILE_SECRET_KEY` (secret key), plus `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_CONTACT_PHONE` for the footer and privacy page. Redeploy; `NEXT_PUBLIC_` values are built into the page.

## Run it locally

You need Node 20 or newer.

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import `rr-unfinished/scm-grader`.
2. Leave the defaults (framework: Next.js) and click **Deploy**.
3. Later, add a custom domain such as `grader.southcoastmarketing.com` under **Settings → Domains**.

API keys go in **Settings → Environment Variables**, never in the code. See `.env.example` for the list. After adding or changing a key, redeploy so it takes effect.

## How it's built

```
app/
  page.tsx              Page shell (header, grader, footer)
  api/grade/route.ts    POST endpoint that returns a Report
components/
  Grader.tsx            Start, quiz and scan screens
  ReportView.tsx        The results report
lib/
  types.ts              Report, Category, Check shapes
  practice-types.ts     Practice types, patient values, South Bay cities
  scoring.ts            Category scores, totals, revenue estimate
  google-places.ts      Server-only Google Places API (New) client
  live-report.ts        Builds the report from live Google data
  pagespeed.ts          Mobile load time from PageSpeed Insights
  site-scan.ts          Safe homepage fetch + website/AI-readiness analysis
  leads.ts              Saves leads and reports in Supabase; reads saved reports
  guard.ts              Scan reuse and per-visitor limits
  turnstile.ts          Cloudflare bot check (server side)
  attio.ts              Sends each lead to Attio (company, person, note)
  email.ts              Report email to the practice, lead alerts to South Coast (Resend)
  ai-check.ts           Asks ChatGPT for local recommendations and checks for the practice
  sample-report.ts      Sample data, used only when no Google key is set
app/api/places/autocomplete/route.ts   Practice search, proxied so the key stays on the server
app/api/book/route.ts                  Records a call request and notifies South Coast once
app/r/[id]/page.tsx                    Saved report page (private link, not indexed)
app/privacy/page.tsx                   Privacy policy
supabase/schema.sql                    Leads table, run once in Supabase
```

## How the Google checks work

- **Practice search** uses Places Autocomplete, limited to the South Bay. Picking a result gives the exact Google listing, so the scan never guesses which practice was meant.
- **Map rank** runs a Text Search for the practice type (for example "dentist") centered on the chosen city, then finds the practice's position in the top 20. Real rank shifts with where a patient searches, and the report says so.
- **Profile and review checks** come from Place Details: category, website, phone, hours, photos, rating and review count. Google returns at most 10 photos per place, so the photo check uses a 10-photo threshold.
- An autocomplete session token is reused on the Place Details call, which is how Google bills a search-then-select as one session.
- **Not checked:** review recency. Google's API returns only 5 "most relevant" reviews, not the newest, so it can't tell when the last review came in. Orthodontists and med spas are graded leniently on category, because Google's API reports them as "Dentist" and "Spa".

## How the ChatGPT check works

- The scan asks ChatGPT, with web search on and a location hint for the chosen city, for example "What are the best dentists in Torrance, California?" If the first answer doesn't name the practice, it asks a second way. This runs in parallel with the website checks, inside a 42-second budget.
- The practice passes if either answer names it. Matching ignores generic words like "Dental" or "Family" and the city name, so "SmileWell Family Dentistry" matches "SmileWell". A generic name like "Physical Therapy San Pedro" only counts when written as a name, with the same capitals, so ordinary wording doesn't trigger it. A mention of the practice's website domain also counts.
- AI answers vary from one run to the next, which is why it asks twice. If OpenAI can't be reached, the check is left out rather than failed.
- Model defaults to `gpt-5-mini` with low reasoning effort, because larger models hit rate limits quickly on new OpenAI accounts. Set `OPENAI_MODEL` to change it. A rate-limited call is retried once.
- OpenAI's API is billed separately from ChatGPT subscriptions; keep auto-recharge on so the check doesn't stop when credit runs out.

## How the website checks work

- **Mobile speed** comes from PageSpeed Insights (same Google key). It uses real-visitor load times from Chrome when Google has enough traffic data for the site, and Google's mobile lab test otherwise. PageSpeed often takes 15 to 30 seconds. If it times out, the speed check is left out rather than guessed.
- **Homepage scan** loads the website linked on Google, the way a phone would, and looks for a `tel:` link, online booking (common booking tools or "book an appointment" links), links to at least 3 service pages, insurance or financing info, local business structured data, and FAQ content.
- The website address comes from the business's Google listing, so the scan only fetches public http(s) addresses on standard ports. It refuses private, local and cloud-metadata addresses, checks every redirect, and stops reading after 2 MB.
- Only the homepage is scanned. A site that keeps booking or services deeper in the site with no homepage link will miss those checks.
- If a site blocks the scan, its checks are skipped and left out of the score instead of counted as failures. The total is scaled over the categories that could be measured.

The browser calls `POST /api/grade` with `{ practiceName, city, practiceType, placeId, sessionToken }` and gets back a `Report`. Later stages change only what happens inside that endpoint, so the screens stay the same.
