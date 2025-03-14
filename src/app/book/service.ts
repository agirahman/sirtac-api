import { PrismaClient } from "@prisma/client";
import { BookDTO, UpdateBookDTO } from "./dto";
import { ConflictError } from "../../error/ConflictError";
import { NotFoundError } from "../../error/NotFoundError";
import { sendEmail } from "../../utils/emailSender";

const prisma = new PrismaClient();
const MAX_LOANS = 5;

export const createBook = async (data: BookDTO) => {
  return await prisma.book.create({ data });
};

export const getAllBooks = async () => {
  return await prisma.book.findMany();
};

export const getBookById = async (id: string) => {
  return await prisma.book.findUnique({ where: { id } });
};

export const updateBook = async (id: string, data: UpdateBookDTO) => {
  return await prisma.book.update({ where: { id }, data });
};

export const deleteBook = async (id: string) => {
  return await prisma.book.delete({ where: { id } });
};

export const borrowBook = async (
  userId: string,
  bookId: string,
  dueDate: Date
) => {
  const book = await prisma.book.findUnique({ where: { id: bookId } });

  if (!book) {
    throw new NotFoundError("Book not found");
  }

  if (book.stock <= 0) {
    throw new Error("Book out of stock");
  }

  const activeLoans = await prisma.loan.count({
    where: {
      userId,
      returnedAt: null,
    },
  });

  if (activeLoans >= MAX_LOANS) {
    throw new Error(
      `You cannot borrow more than ${MAX_LOANS} books at a time.`
    );
  }

  const existingLoan = await prisma.loan.findFirst({
    where: {
      id: bookId,
      userId,
      returnedAt: null,
    },
  });

  if (existingLoan) throw new ConflictError("Book already borrowed");

  const loan = await prisma.loan.create({
    data: {
      bookId,
      userId,
      dueDate,
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      stock: book.stock - 1,
    },
  });

  return loan;
};

export const getUserLoans = async (userId: string) => {
  try {
    const loans = await prisma.loan.findMany({
      where: { userId },
      include: {
        book: true,
      },
      orderBy: {
        borrowedAt: "desc",
      },
    });

    // Filter out any loans where the book is null (book not found cases)
    return loans.filter((loan) => loan.book !== null);
  } catch (error) {
    console.error("Error fetching user loans:", error);
    throw error;
  }
};

export const returnBook = async (userId: string, bookId: string) => {
  const loan = await prisma.loan.findFirst({
    where: {
      bookId,
      userId,
      returnedAt: null,
    },
  });

  if (!loan) {
    throw new ConflictError("No active loan found for this book.");
  }

  const updatedLoan = await prisma.loan.update({
    where: { id: loan.id },
    data: {
      returnedAt: new Date(),
    },
  });

  await prisma.book.update({
    where: { id: bookId },
    data: {
      stock: { increment: 1 },
    },
  });

  return updatedLoan;
};

export const checkOverdueLoans = async () => {
  const overdueLoans = await prisma.loan.findMany({
    where: {
      dueDate: {
        lt: new Date(),
      },
      returnedAt: null,
      isOverdueNotified: false,
    },
    include: {
      user: true,
      book: true,
    },
  });

  for (const loan of overdueLoans) {
    const { user, book } = loan;

    const emailBody = `
      <h1>Reminder: Overdue Book</h1>
      <p>Hello ${user.name},</p>
      <p>The book <b>${book.title}</b> you borrowed is overdue.</p>
      <p>Please return it as soon as possible.</p>
    `;

    await sendEmail({
      to: user.email,
      subject: "Overdue Book Reminder",
      html: emailBody,
    });

    await prisma.loan.update({
      where: { id: loan.id },
      data: { isOverdueNotified: true },
    });

    console.log(`Reminder email sent to ${user.email}`);
  }
};
