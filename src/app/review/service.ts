import { PrismaClient } from "@prisma/client";
import { ForbiddenError } from "../../error/ForbidenError";

const prisma = new PrismaClient();

export const addReview = async (
  userId: string,
  bookId: string,
  rating: number,
  comment?: string
) => {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating harus antara 1-5");
  }
  const existingReview = await prisma.review.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });
  if (existingReview) {
    throw new Error("Kamu sudah memberikan review untuk buku ini.");
  }
  const review = await prisma.review.create({
    data: { userId, bookId, rating, comment },
  });

  const avgRating = await prisma.review.aggregate({
    where: { bookId },
    _avg: { rating: true },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: { rating: avgRating._avg.rating || 0 },
  });

  return review;
};

export const getReviewsByBook = async (bookId: string) => {
  return prisma.review.findMany({
    where: { bookId },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
};

export const getAllReviews = async () => {
  return prisma.review.findMany();
};

export const deleteReview = async (
  userId: string,
  reviewId: string,
  isAdmin: boolean
) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) throw new Error("Review tidak ditemukan");

  if (review.userId !== userId && !isAdmin) {
    throw new ForbiddenError("Tidak diizinkan menghapus review ini");
  }
  await prisma.review.delete({ where: { id: reviewId } });
};
