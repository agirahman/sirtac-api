export interface UserDTO {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface UpdateProfileData {
  name?: string;
  password?: string;
  phone?: string; // Make sure phone is included here
}

export interface UserPayload {
  id: string;
  email: string;
  role: string;
}

export interface FileUpload {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface ContactFormRequest {
  name: string;
  email: string;
  message: string;
}

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}
