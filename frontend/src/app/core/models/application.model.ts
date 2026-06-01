export interface ApplicationItem {
  id: string;
  job_id: string;
  job_title?: string;
  resume_id?: string;
  current_stage: string;
  created_at?: string;
}

export interface Applicant {
  id: string;
  seeker_id: string;
  seeker_email: string;
  job_id: string;
  job_title: string;
  resume_id: string;
  cover_letter: string;
  current_stage: string;
  created_at: string;
}

export interface InterviewResponse {
  id: string;
  scheduled_at: string;
  expires_at: string;
  jitsi_link: string;
  recruiter_notes: string;
  is_expired: boolean;
}
