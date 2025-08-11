import { prisma } from "@/lib/prisma";
import { fetchLatestVideos, fetchVideoDetails, resolveChannelId } from "@/lib/youtube";
import { getTranscriptText } from "@/lib/transcript";
import { uploadThumbnailFromUrl } from "@/lib/storage";
import { NextRequest } from "next/server";

function sseStream(controller: ReadableStreamDefaultController, data: object) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(req: NextRequest) {
  const { input } = await req.json();
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

        sseStream(controller, { type: "info", message: "Fetching latest videos..." });
        const basics = await fetchLatestVideos(channelId, 100);
        const details = await fetchVideoDetails(basics.map((b) => b.videoId));

        // merge publishedAt from basics
        const mapPub = new Map(basics.map((b) => [b.videoId, b.publishedAt]));
        let merged = details.map((d) => ({ ...d, publishedAt: mapPub.get(d.videoId) || d.publishedAt }));

        // sort by views desc
        merged = merged.sort((a, b) => b.views - a.views);

        sseStream(controller, { type: "info", message: "Fetching transcripts and saving..." });
        let idx = 0;
        for (const v of merged) {
          idx += 1;
          sseStream(controller, { type: "progress", current: idx, total: merged.length });
          const transcript = await getTranscriptText(v.videoId);
          const storedThumb = await uploadThumbnailFromUrl(v.videoId, v.thumbnailURL);
          await prisma.video.create({
            data: {
              jobId: job.id,
              videoId: v.videoId,
              title: v.title,
              views: v.views,
              likes: v.likes,
              comments: v.comments,
              thumbnailURL: storedThumb,
              transcript,
              publishedAt: new Date(v.publishedAt),
            },
          });
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


