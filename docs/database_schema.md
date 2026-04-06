# Database Schema — All Services

## Overview

- One PostgreSQL server
- pgvector extension enabled
- 7 schemas, one per service
- No foreign keys across schemas
- All tables have `created_at` and `updated_at` for audit trail
- All primary keys are UUID (looks professional, avoids ID guessing)

---

## 1. auth_schema

### users
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | auto-generated |
| email | VARCHAR(255) UNIQUE NOT NULL | login identifier |
| password_hash | VARCHAR(255) NOT NULL | bcrypt hashed |
| role | VARCHAR(20) NOT NULL | 'seeker', 'recruiter', 'admin' |
| is_active | BOOLEAN DEFAULT true | soft disable account |
| is_verified | BOOLEAN DEFAULT false | email verified? |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### email_otps
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL | references users.id (same schema) |
| otp_code | VARCHAR(6) NOT NULL | 6-digit code |
| purpose | VARCHAR(30) NOT NULL | 'verify_email', 'reset_password' |
| expires_at | TIMESTAMPTZ NOT NULL | now() + 10 minutes |
| is_used | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### audit_logs
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID | who did it |
| action | VARCHAR(50) NOT NULL | 'login', 'logout', 'password_reset' |
| ip_address | VARCHAR(45) | IPv4 or IPv6 |
| user_agent | TEXT | browser info |
| created_at | TIMESTAMPTZ DEFAULT now() | |

---

## 2. profile_schema

### seeker_profiles
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID UNIQUE NOT NULL | from auth_schema (no FK, just stored) |
| first_name | VARCHAR(100) NOT NULL | |
| last_name | VARCHAR(100) NOT NULL | |
| phone | VARCHAR(20) | |
| current_title | VARCHAR(150) | e.g. "Frontend Developer" |
| summary | TEXT | about me section |
| github_url | VARCHAR(255) | |
| linkedin_url | VARCHAR(255) | |
| profile_picture_key | VARCHAR(500) | S3 key |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### recruiter_profiles
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID UNIQUE NOT NULL | from auth_schema |
| company_name | VARCHAR(200) NOT NULL | |
| company_size | VARCHAR(50) | '1-10', '11-50', '51-200', '200+' |
| industry | VARCHAR(100) | |
| hq_location | VARCHAR(200) | |
| website_url | VARCHAR(255) | |
| company_logo_key | VARCHAR(500) | S3 key |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### skills
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(100) UNIQUE NOT NULL | 'Python', 'React', 'Django' |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### seeker_skills
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| seeker_id | UUID NOT NULL | references seeker_profiles.id |
| skill_id | UUID NOT NULL | references skills.id |
| years_of_experience | SMALLINT | 0-30 |
| UNIQUE | (seeker_id, skill_id) | no duplicates |

### experiences
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| seeker_id | UUID NOT NULL | references seeker_profiles.id |
| company_name | VARCHAR(200) NOT NULL | |
| role_title | VARCHAR(150) NOT NULL | |
| start_date | DATE NOT NULL | |
| end_date | DATE | NULL means currently working |
| description | TEXT | what they did |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### resumes
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| seeker_id | UUID NOT NULL | references seeker_profiles.id |
| resume_title | VARCHAR(200) NOT NULL | e.g. "My Backend Resume" |
| s3_key | VARCHAR(500) NOT NULL | path in S3 bucket |
| file_size_bytes | INTEGER | |
| content_type | VARCHAR(50) | 'application/pdf' |
| is_primary | BOOLEAN DEFAULT false | active resume for matching |
| raw_text | TEXT | extracted by PyMuPDF |
| parsing_status | VARCHAR(20) DEFAULT 'pending' | 'pending','success','failed' |
| parsing_error | TEXT | error message if failed |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

---

## 3. job_schema

### job_categories
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| name | VARCHAR(100) UNIQUE NOT NULL | 'Software Engineering', 'Marketing' |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### jobs
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| recruiter_id | UUID NOT NULL | from profile_schema (no FK) |
| category_id | UUID | references job_categories.id |
| title | VARCHAR(200) NOT NULL | |
| slug | VARCHAR(220) UNIQUE NOT NULL | url-friendly version of title |
| description | TEXT NOT NULL | full job description |
| location_type | VARCHAR(20) NOT NULL | 'remote', 'hybrid', 'onsite' |
| location_city | VARCHAR(100) | required if onsite/hybrid |
| salary_min | INTEGER | monthly in INR or annual |
| salary_max | INTEGER | |
| currency | VARCHAR(10) DEFAULT 'INR' | |
| experience_required | VARCHAR(50) | '0-1 years', '2-4 years' |
| status | VARCHAR(20) DEFAULT 'draft' | 'draft', 'published', 'closed' |
| total_applications | INTEGER DEFAULT 0 | denormalized counter |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### job_requirements
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| job_id | UUID NOT NULL | references jobs.id |
| requirement_text | VARCHAR(300) NOT NULL | e.g. "3+ years Django experience" |
| is_mandatory | BOOLEAN DEFAULT true | |

### job_skills
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| job_id | UUID NOT NULL | references jobs.id |
| skill_name | VARCHAR(100) NOT NULL | stored as text, no FK to profile_schema |
| is_required | BOOLEAN DEFAULT true | |

---

## 4. app_schema

### applications
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| job_id | UUID NOT NULL | from job_schema (no FK) |
| seeker_id | UUID NOT NULL | from profile_schema (no FK) |
| resume_id | UUID NOT NULL | from profile_schema (no FK) |
| cover_letter | TEXT | optional |
| current_stage | VARCHAR(30) DEFAULT 'applied' | see stages below |
| is_withdrawn | BOOLEAN DEFAULT false | seeker withdraws application |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |
| UNIQUE | (job_id, seeker_id) | can't apply twice |

Application stages: `applied` → `screening` → `interview_scheduled` → `offered` → `rejected`

### application_stage_history
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| application_id | UUID NOT NULL | references applications.id |
| old_stage | VARCHAR(30) | |
| new_stage | VARCHAR(30) NOT NULL | |
| changed_by | UUID NOT NULL | recruiter user_id |
| note | TEXT | optional recruiter note |
| changed_at | TIMESTAMPTZ DEFAULT now() | |

### application_notes
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| application_id | UUID NOT NULL | references applications.id |
| recruiter_id | UUID NOT NULL | |
| note_text | TEXT NOT NULL | internal recruiter notes |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### interviews
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| application_id | UUID UNIQUE NOT NULL | one interview per application at a time |
| scheduled_at | TIMESTAMPTZ NOT NULL | when the interview is |
| expires_at | TIMESTAMPTZ NOT NULL | scheduled_at + 2 hours |
| jitsi_room_id | VARCHAR(100) NOT NULL | UUID used in the URL |
| jitsi_link | VARCHAR(300) NOT NULL | full https://meet.jit.si/... URL |
| is_expired | BOOLEAN DEFAULT false | updated by a scheduled task |
| recruiter_notes | TEXT | pre-interview notes |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

---

## 5. match_schema

### resume_embeddings
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | created_at|
| resume_id | UUID UNIQUE NOT NULL | from profile_schema (no FK) |
| seeker_id | UUID NOT NULL | for quick lookup |
| embedding | vector(384) NOT NULL | all-MiniLM-L6-v2 output |
| model_version | VARCHAR(50) DEFAULT 'all-MiniLM-L6-v2' | track which model |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### job_embeddings
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| job_id | UUID UNIQUE NOT NULL | from job_schema (no FK) |
| embedding | vector(384) NOT NULL | |
| model_version | VARCHAR(50) DEFAULT 'all-MiniLM-L6-v2' | |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| updated_at | TIMESTAMPTZ DEFAULT now() | |

### match_results
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| job_id | UUID NOT NULL | |
| resume_id | UUID NOT NULL | |
| seeker_id | UUID NOT NULL | |
| similarity_score | DECIMAL(5,4) NOT NULL | 0.0000 to 1.0000 |
| matched_skills | JSONB | ["Python", "Django"] |
| last_calculated | TIMESTAMPTZ DEFAULT now() | |
| UNIQUE | (job_id, resume_id) | |

**pgvector index for fast similarity search:**
```sql
CREATE INDEX ON match_schema.resume_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX ON match_schema.job_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

## 6. notification_schema

### notifications
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| user_id | UUID NOT NULL | who receives it |
| type | VARCHAR(50) NOT NULL | 'application_update', 'interview_scheduled', 'welcome' |
| title | VARCHAR(200) NOT NULL | short title for bell icon |
| message | TEXT NOT NULL | full message |
| is_read | BOOLEAN DEFAULT false | |
| related_id | UUID | e.g. application_id for context |
| created_at | TIMESTAMPTZ DEFAULT now() | |

### email_logs
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| to_email | VARCHAR(255) NOT NULL | |
| subject | VARCHAR(300) NOT NULL | |
| template_name | VARCHAR(100) | which email template was used |
| status | VARCHAR(20) DEFAULT 'sent' | 'sent', 'failed' |
| error_message | TEXT | if failed |
| sent_at | TIMESTAMPTZ DEFAULT now() | |

---

## 7. chat_schema (Placeholder)

### conversations
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| seeker_id | UUID NOT NULL | |
| recruiter_id | UUID NOT NULL | |
| job_id | UUID | context job |
| created_at | TIMESTAMPTZ DEFAULT now() | |
| UNIQUE | (seeker_id, recruiter_id, job_id) | |

### messages
| Column | Type | Notes |
|---|---|---|
| id | UUID PK | |
| conversation_id | UUID NOT NULL | references conversations.id |
| sender_id | UUID NOT NULL | |
| content | TEXT NOT NULL | |
| is_read | BOOLEAN DEFAULT false | |
| created_at | TIMESTAMPTZ DEFAULT now() | |

---

## Cross-Service Data Flow (No Foreign Keys)

Since services don't share schemas, here is how they reference each other:

```
auth_schema.users.id
    ↓ stored as user_id (plain UUID column, no FK)
profile_schema.seeker_profiles.user_id
profile_schema.recruiter_profiles.user_id

profile_schema.seeker_profiles.id
    ↓ stored as seeker_id
app_schema.applications.seeker_id
match_schema.resume_embeddings.seeker_id

profile_schema.resumes.id
    ↓ stored as resume_id
app_schema.applications.resume_id
match_schema.resume_embeddings.resume_id

job_schema.jobs.id
    ↓ stored as job_id
app_schema.applications.job_id
match_schema.job_embeddings.job_id
match_schema.match_results.job_id
```

When a service needs data from another schema, it makes an internal HTTP call to that service's API — never a direct DB query across schemas.

---

## Sample Data (To Visualize)

### auth_schema.users
```
id: a1b2c3d4-...  | email: rahul@gmail.com    | role: seeker    | is_verified: true
id: e5f6g7h8-...  | email: priya@techcorp.com | role: recruiter | is_verified: true
id: admin001-...  | email: admin@portal.com   | role: admin     | is_verified: true
```

### profile_schema.seeker_profiles
```
user_id: a1b2c3d4-... | first_name: Rahul | last_name: Sharma | current_title: Full Stack Developer
                      | summary: 2 years experience in Django and React
                      | github_url: github.com/rahulsharma
```

### profile_schema.recruiter_profiles
```
user_id: e5f6g7h8-... | company_name: TechCorp India | industry: Software
                      | company_size: 51-200 | hq_location: Bangalore
```

### job_schema.jobs
```
id: job001-... | recruiter_id: e5f6g7h8-... | title: Backend Developer - Django
               | location_type: remote | salary_min: 40000 | salary_max: 70000
               | status: published | experience_required: 1-3 years
```

### app_schema.applications
```
id: app001-... | job_id: job001-... | seeker_id: a1b2c3d4-...
               | current_stage: interview_scheduled | created_at: 2025-07-01
```

### app_schema.interviews
```
application_id: app001-... | scheduled_at: 2025-08-10 15:00 IST
                           | jitsi_link: https://meet.jit.si/jobportal-a3f9c2d1
                           | expires_at: 2025-08-10 17:00 IST
```

### match_schema.match_results
```
job_id: job001-... | resume_id: res001-... | seeker_id: a1b2c3d4-...
                   | similarity_score: 0.8923 | matched_skills: ["Django", "Python", "REST API"]
```

### notification_schema.notifications
```
user_id: a1b2c3d4-... | type: interview_scheduled
                      | title: Interview Scheduled!
                      | message: Your interview for Backend Developer at TechCorp is on Aug 10 at 3:00 PM
                      | is_read: false
```
