export interface UserDTO {
  name: string;
  email: string;
  password: string;
}

export interface UpdateProfileData {
  name?: string;
  password?: string;
}
