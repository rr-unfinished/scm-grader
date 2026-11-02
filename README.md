# South Coast Marketing Practice Grader

A free online health score for South Bay dental and medical practices. A practice enters its name, answers three short questions, and gets a score out of 100 across Google search, website, reviews and AI search. That report is the lead magnet that books free audit calls.

## Status

**Stage 2: complete.** Practice search, map rank, Google profile checks, reviews and competitors use live Google data. Website and AI search are still sample results, labeled "Preview" in the report, until stages 3 and 4.

Without `GOOGLE_PLACES_API_KEY` the app falls back to sample data for everything, so it still runs locally with no keys.

| Stage | What it adds | Status |
| --- | --- | --- |
| 1 | App, screens, sample data, `/api/grade` endpoint | Done |
| 2 | Live Google data: Places autocomplete, map rank, rating, reviews, competitors | Done |
| 3 | PageSpeed mobile speed and website checks (tap-to-call, booking, schema) | Next |
| 4 | AI search check (ChatGPT / Perplexity) | |
| 5 | Save leads (Supabase), email the report (Resend), notify South Coast | |
| 6 | Bot protection (Turnstile), caching, privacy page | |

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
  sample-report.ts      Sample data (Website and AI until stages 3 and 4)
app/api/places/autocomplete/route.ts   Practice search, proxied so the key stays on the server
```

## How the Google checks work

- **Practice search** uses Places Autocomplete, limited to the South Bay. Picking a result gives the exact Google listing, so the scan never guesses which practice was meant.
- **Map rank** runs a Text Search for the practice type (for example "dentist") centered on the chosen city, then finds the practice's position in the top 20. Real rank shifts with where a patient searches, and the report says so.
- **Profile and review checks** come from Place Details: category, website, phone, hours, photos, rating and review count. Google returns at most 10 photos per place, so the photo check uses a 10-photo threshold.
- **Not checked:** review recency. Google's API returns only 5 "most relevant" reviews, not the newest, so it can't tell when the last review came in. Orthodontists and med spas are graded leniently on category, because Google's API reports them as "Dentist" and "Spa".
- An autocomplete session token is reused on the Place Details call, which is how Google bills a search-then-select as one session.

The browser calls `POST /api/grade` with `{ practiceName, city, practiceType, placeId, sessionToken }` and gets back a `Report`. Later stages change only what happens inside that endpoint, so the screens stay the same.
