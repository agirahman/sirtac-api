export interface ReviewDTO {
  rating: number;
  comment?: string;
}

export interface ReviewResponse {
  id: string;
  userId: string;
  rating: number;
  comment?: string;
  createdAt: Date;
}
