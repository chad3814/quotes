/*
  Warnings:

  - You are about to drop the column `tmdbId` on the `Character` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Actor" ADD COLUMN     "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Character" DROP COLUMN "tmdbId";
