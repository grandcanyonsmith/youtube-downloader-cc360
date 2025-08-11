import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");
  if (!jobId) return new Response("Missing jobId", { status: 400 });

  const videos = await prisma.video.findMany({ where: { jobId }, orderBy: { views: "desc" } });
  const rows = videos.map((v) => ({
    videoId: v.videoId,
    title: v.title,
    views: v.views,
    likes: v.likes,
    comments: v.comments,
    thumbnailURL: v.thumbnailURL,
    transcript: v.transcript || "",
    scrapedAt: v.scrapedAt.toISOString(),
    publishedAt: v.publishedAt.toISOString(),
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Videos");
  const arr = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;

  return new Response(Buffer.from(arr), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=videos_${jobId}.xlsx`,
    },
  });
}


