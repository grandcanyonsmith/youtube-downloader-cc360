import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("query") || undefined;

  const job = await prisma.scrapeJob.findFirst({
    where: q ? { query: q } : undefined,
    orderBy: { createdAt: "desc" },
  });

  if (!job) return Response.json({ jobId: null, rows: [] });

  const videos = await prisma.video.findMany({ where: { jobId: job.id }, orderBy: { views: "desc" } });
  return Response.json({
    jobId: job.id,
    rows: videos.map((v) => ({
      videoId: v.videoId,
      videoURL: (v as unknown as { videoURL?: string }).videoURL || `https://www.youtube.com/watch?v=${v.videoId}`,
      audioURL: (v as unknown as { audioURL?: string }).audioURL || undefined,
      title: v.title,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      thumbnailURL: v.thumbnailURL,
      transcript: v.transcript || undefined,
      transcriptURL: (v as unknown as { transcriptURL?: string }).transcriptURL || undefined,
      publishedAt: v.publishedAt.toISOString(),
    })),
  });
}


