/*
  Warnings:

  - You are about to drop the column `profilepicture` on the `User` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[userId]` on the table `ProfilePicture` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[profilePictureId]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "User" DROP COLUMN "profilepicture",
ADD COLUMN     "profilePictureId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProfilePicture_userId_key" ON "ProfilePicture"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "User_profilePictureId_key" ON "User"("profilePictureId");
