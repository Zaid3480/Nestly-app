export interface UserEntity {
  id: string;

  email: string;
  password_hash: string | null;
  role: "USER" | "ADMIN";
  is_active: boolean;

  auth_provider: "LOCAL" | "GOOGLE" | "APPLE" | "MOCK";
  google_sub?: string | null;

  first_name?: string | null;
  last_name?: string | null;
  mobile_no?: string | null;



  interests?: string[] | null;
  preferred_locations?: string[] | null;
  
  budget?: string | null;        

  birth_date?: Date | null;

  created_at: Date;
  updated_at: Date;
}
