YouTube Channel Scraper – Next.js 14 + Prisma + Supabase

Features
- Input a YouTube channel URL/username/handle
- Scrape latest 100 videos, then sort by most viewed
- Collect title, views, likes, comments, thumbnail URL, transcript (with optional AI fallback)
- Save results to Postgres (Supabase/Railway) via Prisma
- Show real-time progress (SSE)
- Export CSV and Excel

Setup
1. Copy `.env.example` → `.env.local` and fill values:
   - `DATABASE_URL` (Supabase/Railway Postgres)
   - `YOUTUBE_API_KEY`
   - Optional: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`
   - Optional: `OPENAI_API_KEY`, set `ENABLE_WHISPER_FALLBACK=true` to enable AI transcript fallback
2. Install deps: `npm install`
3. Generate Prisma client: `npx prisma generate`
4. Push schema: `npx prisma db push`
5. Dev: `npm run dev`

Deploy
- Vercel for frontend+backend (App Router API routes)
- Supabase for Postgres + Storage

E2E Flow
- Enter channel query → backend resolves to channelId
- Fetch latest 100 videos → fetch stats → sort desc by views
- Enrich with transcript → upload thumbnail to Supabase (optional)
- Persist to DB → render table → export CSV/Excel

CI/CD
- Add GitHub Actions or Vercel CI as desired
