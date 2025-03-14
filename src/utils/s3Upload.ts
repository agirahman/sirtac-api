import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "./s3";
import { v4 as uuidv4 } from "uuid";

export const uploadToS3 = async (userId: string, file: Express.Multer.File) => {
  const fileExtension = file.originalname.split(".").pop();
  const fileName = `profile-picture/${userId}-${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

export const uploadBookFileToS3 = async (
  bookId: string,
  file: Express.Multer.File
) => {
  const fileExtension = file.originalname.split(".").pop();
  const fileName = `book-files/${bookId}-${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};

export const uploadBookCoverToS3 = async (
  bookId: string,
  file: Express.Multer.File
) => {
  const fileExtension = file.originalname.split(".").pop();
  const fileName = `book-covers/${bookId}-${uuidv4()}.${fileExtension}`;

  const uploadParams = {
    Bucket: process.env.AWS_S3_BUCKET_NAME!,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype,
  };

  await s3Client.send(new PutObjectCommand(uploadParams));

  return `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;
};
