-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('SPEND', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "expense" ADD COLUMN     "kind" "EntryKind" NOT NULL DEFAULT 'SPEND';
