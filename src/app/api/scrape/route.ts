import { prisma } from "@/lib/prisma";
import type { Video as VideoModel } from "@prisma/client";
import { fetchLatestVideos, fetchVideoDetails, resolveChannelId } from "@/lib/youtube";
import { getTranscriptText, downloadAndUploadM4A } from "@/lib/transcript";
import { uploadThumbnailFromUrl, uploadTranscriptText } from "@/lib/storage";
import { NextRequest } from "next/server";

function sseStream(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(req: NextRequest) {
  const { input, limit } = await req.json();
  if (!input) {
    return new Response(JSON.stringify({ error: "Missing input" }), { status: 400 });
  }

  const stream = new ReadableStream({
    start: async (controller) => {
      try {
        sseStream(controller, { type: "info", message: "Resolving channel..." });
        const { channelId, channelTitle } = await resolveChannelId(input);
        const job = await prisma.scrapeJob.create({ data: { query: input, channelId, status: "RUNNING" } });
        sseStream(controller, { type: "info", message: `Channel: ${channelTitle} (${channelId})`, jobId: job.id });

        const max = Math.min(100, Math.max(1, Number(limit) || 100));
        sseStream(controller, { type: "info", message: `Fetching latest ${max} videos...` });
        const basics = await fetchLatestVideos(channelId, max);
        const details = await fetchVideoDetails(basics.map((b) => b.videoId));

        // merge publishedAt from basics
        const mapPub = new Map(basics.map((b) => [b.videoId, b.publishedAt]));
        let merged = details.map((d) => ({ ...d, publishedAt: mapPub.get(d.videoId) || d.publishedAt }));

        // sort by views desc
        merged = merged.sort((a, b) => b.views - a.views);

        sseStream(controller, { type: "info", message: "Fetching transcripts, downloading audio, and saving..." });
        // Defensive migration: ensure audioURL column exists in production DB
        try {
          await prisma.$executeRawUnsafe('ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "audioURL" text');
        } catch {}
        let idx = 0;
        for (const v of merged) {
          idx += 1;
          sseStream(controller, { type: "progress", current: idx, total: merged.length });
          let existing: VideoModel | null = null;
          try {
            existing = await prisma.video.findFirst({ where: { videoId: v.videoId }, orderBy: { scrapedAt: "desc" } });
          } catch {
            // Try to create missing column then retry once
            try { await prisma.$executeRawUnsafe('ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "audioURL" text'); } catch {}
            existing = await prisma.video.findFirst({ where: { videoId: v.videoId }, orderBy: { scrapedAt: "desc" } });
          }
          if (existing && existing.transcript) {
            await prisma.video.create({
              data: {
                jobId: job.id,
                videoId: existing.videoId,
                videoURL: existing.videoURL || `https://www.youtube.com/watch?v=${existing.videoId}`,
                title: existing.title,
                views: v.views, // update dynamic stats with fresh values
                likes: v.likes,
                comments: v.comments,
                thumbnailURL: existing.thumbnailURL,
                transcript: existing.transcript,
                transcriptURL: existing.transcriptURL,
                audioURL: (existing as unknown as { audioURL?: string }).audioURL || undefined,
                publishedAt: existing.publishedAt,
              },
            });
          } else {
            // Only (re)fetch transcript if previously missing
            const transcript = existing?.transcript || (await getTranscriptText(v.videoId));
            const storedThumb = await uploadThumbnailFromUrl(v.videoId, v.thumbnailURL);
            const transcriptURL = transcript ? await uploadTranscriptText(v.videoId, transcript) : null;
            // Download audio and upload to S3 as m4a
            const audioURL = (existing as unknown as { audioURL?: string })?.audioURL || (await downloadAndUploadM4A(v.videoId));
            await prisma.video.create({
              data: {
                jobId: job.id,
                videoId: v.videoId,
                videoURL: v.videoURL,
                title: v.title,
                views: v.views,
                likes: v.likes,
                comments: v.comments,
                thumbnailURL: storedThumb,
                transcript,
                transcriptURL,
                audioURL: audioURL || undefined,
                publishedAt: new Date(v.publishedAt),
              },
            });
          }
        }

        await prisma.scrapeJob.update({ where: { id: job.id }, data: { status: "COMPLETED" } });
        sseStream(controller, { type: "done", message: "Completed", jobId: job.id });
        controller.close();
      } catch (e: unknown) {
        const message = e instanceof Error ? e.message : "Unknown error";
        sseStream(controller, { type: "error", message });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}


