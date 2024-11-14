import { PrismaClient } from "../prisma/client";
export { Prisma } from "../prisma/client";
export * as runtimeLibrary from "../prisma/client/runtime/library";

const db = new PrismaClient();
export default db;
