import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response(JSON.stringify({ rows: [] }), { status: 200 });
  // Defensive migration: ensure audioURL column exists
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "audioURL" text');
  } catch {}
  const videos = await prisma.video.findMany({ where: { jobId }, orderBy: { views: "desc" } });
  return Response.json({
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
      transcriptURL: v.transcriptURL || undefined,
      publishedAt: v.publishedAt.toISOString(),
    })),
  });
}


