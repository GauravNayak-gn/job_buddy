export interface Job {
  id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
  status?: string;
  created_at?: string;
  screening_questions?: string[];
}

export interface RecruiterJob {
  id: string;
  recruiter_id: string;
  title: string;
  description: string;
  location_type: string;
  location_city: string;
  experience_required: string;
  salary_min: number | null;
  salary_max: number | null;
  status: string;
  is_archived: boolean;
  archived_at: string | null;
  created_at: string;
  screening_questions?: string[];
}

export interface Category {
  id: string;
  name: string;
}

export interface JobSummary {
  id: string;
  title: string;
}
