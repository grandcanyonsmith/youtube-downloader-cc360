import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "Video" ADD COLUMN IF NOT EXISTS "audioURL" text');
    return Response.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: message }), { status: 500 });
  }
}


