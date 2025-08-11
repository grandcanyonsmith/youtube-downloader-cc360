import { prisma } from "@/lib/prisma";

export async function GET() {
  const jobs = await prisma.scrapeJob.findMany({
    orderBy: { createdAt: "desc" },
    take: 25,
    include: { _count: { select: { videos: true } } },
  });
  return Response.json(
    jobs.map((j) => ({
      id: j.id,
      query: j.query,
      channelId: j.channelId,
      createdAt: j.createdAt.toISOString(),
      status: j.status,
      videoCount: (j as { _count?: { videos?: number } })._count?.videos ?? 0,
    }))
  );
}


