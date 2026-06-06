export type UserRole = 'seeker' | 'recruiter' | '';

export interface SessionState {
  access: string;
  refresh: string;
  role: UserRole;
  userId: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  role: 'seeker' | 'recruiter';
  user_id: string;
}

export interface RegisterResponse {
  message: string;
  otp_code?: string;
}

export interface OtpVerifyResponse {
  message: string;
}
