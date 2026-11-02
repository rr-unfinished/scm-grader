# South Coast Marketing Practice Grader

A free online health score for South Bay dental and medical practices. A practice enters its name, answers three short questions, and gets a score out of 100 across Google search, website, reviews and AI search. That report is the lead magnet that books free audit calls.

## Status

**Stage 1: complete.** The full flow works end to end on sample data. Scores are generated from the practice name, so the same name always gets the same report.

| Stage | What it adds | Status |
| --- | --- | --- |
| 1 | App, screens, sample data, `/api/grade` endpoint | Done |
| 2 | Live Google data: Places autocomplete, map rank, rating, reviews, competitors | Next |
| 3 | PageSpeed mobile speed and website checks (tap-to-call, booking, schema) | |
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

Stage 1 needs no API keys. Keys for later stages go in **Settings → Environment Variables**, never in the code. See `.env.example` for the list.

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
  sample-report.ts      Stage 1 sample data (replaced in stage 2)
```

The browser calls `POST /api/grade` with `{ practiceName, city, practiceType }` and gets back a `Report`. Stage 2 changes only what happens inside that endpoint, so the screens stay the same.
