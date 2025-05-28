export interface BookDTO {
  title: string;
  author: string;
  publisher: string;
  description?: string;
  publishedYear: number;
}

export interface UpdateBookDTO {
  title?: string;
  author?: string;
  description?: string;
  publishedYear?: number;
  coverImage?: string;
  fileUrl?: string;
}
