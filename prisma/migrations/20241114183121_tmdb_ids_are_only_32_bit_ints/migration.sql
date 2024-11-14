/*
  Warnings:

  - The `tmdbId` column on the `Actor` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to alter the column `tmdbId` on the `Movie` table. The data in that column could be lost. The data in that column will be cast from `BigInt` to `Integer`.

*/
-- AlterTable
ALTER TABLE "Actor" DROP COLUMN "tmdbId",
ADD COLUMN     "tmdbId" INTEGER;

-- AlterTable
ALTER TABLE "Movie" ALTER COLUMN "tmdbId" SET DATA TYPE INTEGER;

-- CreateIndex
CREATE INDEX "Actor_tmdbId_idx" ON "Actor"("tmdbId");

-- CreateIndex
CREATE UNIQUE INDEX "Actor_tmdbId_key" ON "Actor"("tmdbId");
