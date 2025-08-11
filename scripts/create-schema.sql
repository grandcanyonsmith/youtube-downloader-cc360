DO $$ BEGIN
  CREATE TYPE "JobStatus" AS ENUM ('PENDING','RUNNING','COMPLETED','FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "ScrapeJob" (
  id text PRIMARY KEY,
  query text NOT NULL,
  channelId text NOT NULL,
  createdAt timestamptz NOT NULL DEFAULT now(),
  status "JobStatus" NOT NULL DEFAULT 'PENDING',
  error text
);

CREATE TABLE IF NOT EXISTS "Video" (
  id text PRIMARY KEY,
  jobId text NOT NULL REFERENCES "ScrapeJob"(id) ON DELETE CASCADE,
  videoId text NOT NULL,
  title text NOT NULL,
  views integer NOT NULL DEFAULT 0,
  likes integer NOT NULL DEFAULT 0,
  comments integer NOT NULL DEFAULT 0,
  thumbnailURL text NOT NULL,
  transcript text,
  publishedAt timestamptz NOT NULL,
  scrapedAt timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "Video_jobId_idx" ON "Video"(jobId);
CREATE INDEX IF NOT EXISTS "Video_videoId_idx" ON "Video"(videoId);
