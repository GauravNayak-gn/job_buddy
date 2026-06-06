export interface MatchResponse<T> {
  results: T[];
}

export interface JobMatch {
  job_id: string;
  similarity_score: number;
}

export interface SeekerMatch {
  seeker_id: string;
  resume_id: string;
  similarity_score: number;
  seeker_email?: string;
  application_id?: string;
  current_stage?: string;
  first_name?: string;
  last_name?: string;
}

export interface JobMatchView {
  job_id: string;
  title: string;
  similarity_score: number;
  description?: string;
  location_type?: string;
  location_city?: string;
  experience_required?: string;
  salary_min?: number | null;
  salary_max?: number | null;
  status?: string;
  screening_questions?: string[];
}
