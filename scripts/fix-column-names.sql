ALTER TABLE "ScrapeJob" RENAME COLUMN channelid TO "channelId";
ALTER TABLE "ScrapeJob" RENAME COLUMN createdat TO "createdAt";

ALTER TABLE "Video" RENAME COLUMN jobid TO "jobId";
ALTER TABLE "Video" RENAME COLUMN videoid TO "videoId";
ALTER TABLE "Video" RENAME COLUMN thumbnailurl TO "thumbnailURL";
ALTER TABLE "Video" RENAME COLUMN publishedat TO "publishedAt";
ALTER TABLE "Video" RENAME COLUMN scrapedat TO "scrapedAt";
