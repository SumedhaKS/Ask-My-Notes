/*
  Warnings:

  - A unique constraint covering the columns `[userId,fileHash]` on the table `Document` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `fileHash` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "fileHash" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "Chat_documentId_idx" ON "Chat"("documentId");

-- CreateIndex
CREATE INDEX "Document_userId_idx" ON "Document"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Document_userId_fileHash_key" ON "Document"("userId", "fileHash");
