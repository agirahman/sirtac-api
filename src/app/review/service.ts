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

  // Check if book exists
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new Error("Buku tidak ditemukan");
  }

  // Check if user already reviewed this book
  const existingReview = await prisma.review.findUnique({
    where: { userId_bookId: { userId, bookId } },
  });

  if (existingReview) {
    throw new Error("Kamu sudah memberikan review untuk buku ini.");
  }

  // Create the review
  const review = await prisma.review.create({
    data: { userId, bookId, rating, comment },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // Update book's average rating
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
  // Check if book exists
  const book = await prisma.book.findUnique({
    where: { id: bookId },
  });

  if (!book) {
    throw new Error("Buku tidak ditemukan");
  }

  return prisma.review.findMany({
    where: { bookId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const getAllReviews = async () => {
  return prisma.review.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      book: {
        select: {
          id: true,
          title: true,
          author: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
};

export const deleteReview = async (
  userId: string,
  reviewId: string,
  isAdmin: boolean
) => {
  const review = await prisma.review.findUnique({
    where: { id: reviewId },
    include: {
      book: true,
    },
  });

  if (!review) {
    throw new Error("Review tidak ditemukan");
  }

  if (review.userId !== userId && !isAdmin) {
    throw new ForbiddenError("Tidak diizinkan menghapus review ini");
  }

  await prisma.review.delete({ where: { id: reviewId } });

  // Recalculate book's average rating after deletion
  const avgRating = await prisma.review.aggregate({
    where: { bookId: review.bookId },
    _avg: { rating: true },
  });

  await prisma.book.update({
    where: { id: review.bookId },
    data: { rating: avgRating._avg.rating || 0 },
  });
};
