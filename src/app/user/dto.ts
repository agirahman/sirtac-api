export interface UserDTO {
  name: string;
  email: string;
  password: string;
  phone: string;
}

export interface UpdateProfileData {
  name?: string;
  password?: string;
  phoene?: string;
}

export enum Role {
  USER = "USER",
  ADMIN = "ADMIN",
  SUPERADMIN = "SUPERADMIN",
}
