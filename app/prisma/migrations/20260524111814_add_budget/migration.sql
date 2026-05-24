-- CreateTable
CREATE TABLE "budget" (
    "userId" TEXT NOT NULL,
    "monthlyAmountCents" INTEGER NOT NULL,
    "anchorDay" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budget_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "budget" ADD CONSTRAINT "budget_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
