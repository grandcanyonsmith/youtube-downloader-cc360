import { prisma } from "@/lib/prisma";
import Papa from "papaparse";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const videos = await prisma.video.findMany({ where: { jobId }, orderBy: { views: "desc" } });
  const csv = Papa.unparse(
    videos.map((v) => ({
      videoId: v.videoId,
      videoURL: (v as unknown as { videoURL?: string }).videoURL || `https://www.youtube.com/watch?v=${v.videoId}`,
      audioURL: (v as unknown as { audioURL?: string }).audioURL || "",
      title: v.title,
      views: v.views,
      likes: v.likes,
      comments: v.comments,
      thumbnailURL: v.thumbnailURL,
      transcript: v.transcript || "",
      scrapedAt: v.scrapedAt.toISOString(),
      publishedAt: v.publishedAt.toISOString(),
    }))
  );

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=videos_${jobId}.csv`,
    },
  });
}


