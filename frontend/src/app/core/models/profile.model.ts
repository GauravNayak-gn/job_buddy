export interface SeekerProfile {
  id: string;
  user_id?: string;
  first_name: string;
  last_name: string;
  phone: string;
  current_title: string;
  summary: string;
  github_url: string;
  linkedin_url: string;
  skills?: SeekerSkill[];
  experiences?: SeekerExperience[];
}

export interface SeekerSkill {
  id: string;
  skill_name: string;
  years_of_experience: number;
}

export interface SeekerExperience {
  id: string;
  company_name: string;
  role_title: string;
  start_date: string;
  end_date: string | null;
  description: string;
}

export interface ResumeItem {
  id: string;
  resume_title: string;
  parsing_status: string;
  is_primary?: boolean;
  created_at?: string;
}
