import { PrismaClient } from "@prisma/client";

declare global {
  var prismaGlobal: PrismaClient | undefined;
}

const prismaClient = globalThis.prismaGlobal ?? new PrismaClient();
export const prisma: PrismaClient = prismaClient;

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prismaClient;
}


