import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response(JSON.stringify({ rows: [] }), { status: 200 });
  const videos = await prisma.video.findMany({ where: { jobId }, orderBy: { views: "desc" } });
  return Response.json({
    rows: videos.map((v) => ({
      videoId: v.videoId,
      title: v.title,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      thumbnailURL: v.thumbnailURL,
      transcript: v.transcript || undefined,
      publishedAt: v.publishedAt.toISOString(),
    })),
  });
}


