# Database Schema Documentation

> **Job Buddy** — Complete PostgreSQL database design with 7 schemas, pgvector extension, and 16+ tables.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Schema Architecture](#2-schema-architecture)
3. [Database Initialization](#3-database-initialization)
4. [Schema: auth_schema](#4-schema-auth_schema)
5. [Schema: profile_schema](#5-schema-profile_schema)
6. [Schema: job_schema](#6-schema-job_schema)
7. [Schema: app_schema](#7-schema-app_schema)
8. [Schema: match_schema](#8-schema-match_schema)
9. [Schema: notification_schema](#9-schema-notification_schema)
10. [Schema: chat_schema](#10-schema-chat_schema)
11. [Entity Relationship Overview](#11-entity-relationship-overview)
12. [Design Decisions](#12-design-decisions)
13. [Migration Strategy](#13-migration-strategy)
14. [Common Queries](#14-common-queries)
15. [Performance Notes](#15-performance-notes)

---

## 1. Overview

The database is a **single PostgreSQL 16 instance** named `jobportal_db` with **7 isolated schemas** — one per microservice. The **pgvector** extension is installed for 384-dimensional vector similarity search.

### Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Schema-per-service** | Each microservice owns exactly one schema |
| **No cross-schema foreign keys** | Services reference UUIDs as plain columns |
| **UUID primary keys** | All tables use UUIDv4 for distributed-friendly IDs |
| **JSON for flexible data** | Screening questions, answers, notification payloads |
| **Vector support** | pgvector extension for 384-dim embedding storage |
| **Composite unique constraints** | Prevent duplicate skill assignments |

---

## 2. Schema Architecture

```
Database: jobportal_db
├── Extensions: pgvector, uuid-ossp
│
├── auth_schema          → Auth Service (:8001)
│   ├── users
│   └── email_otps
│
├── profile_schema       → Profile Service (:8002)
│   ├── seeker_profiles
│   ├── recruiter_profiles
│   ├── skills
│   ├── seeker_skills
│   ├── experiences
│   └── resumes
│
├── job_schema           → Job Service (:8003)
│   ├── jobs
│   ├── job_categories
│   └── job_skills
│
├── app_schema           → Application Service (:8004)
│   ├── applications
│   └── interviews
│
├── match_schema         → Matching Service (:8005)
│   ├── job_embeddings
│   └── resume_embeddings
│
├── notification_schema  → Notification Service (:8006)
│   └── notifications
│
└── chat_schema          → Chat Service (:8007)
    ├── conversations
    └── messages
```

---

## 3. Database Initialization

### 3.1 Initialization Script

```sql
-- scripts/init_db.sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS profile_schema;
CREATE SCHEMA IF NOT EXISTS job_schema;
CREATE SCHEMA IF NOT EXISTS app_schema;
CREATE SCHEMA IF NOT EXISTS match_schema;
CREATE SCHEMA IF NOT EXISTS notification_schema;
CREATE SCHEMA IF NOT EXISTS chat_schema;

GRANT ALL ON SCHEMA auth_schema TO admin;
GRANT ALL ON SCHEMA profile_schema TO admin;
GRANT ALL ON SCHEMA job_schema TO admin;
GRANT ALL ON SCHEMA app_schema TO admin;
GRANT ALL ON SCHEMA match_schema TO admin;
GRANT ALL ON SCHEMA notification_schema TO admin;
GRANT ALL ON SCHEMA chat_schema TO admin;
```

### 3.2 Database Connection Configuration

All services share the same database connection (only schema differs via `OPTIONS`):

```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'jobportal_db',
        'USER': 'admin',
        'PASSWORD': 'job@123',
        'HOST': 'localhost',
        'PORT': 5432,
        'OPTIONS': {
            'options': '-c search_path=auth_schema,public'
        }
    }
}
```

Each service sets its own `search_path` to its schema.

---

## 4. Schema: auth_schema

**Owned by**: Auth Service (`backend/auth_service/`)  
**Purpose**: User identity, authentication, email verification  
**Tables**: 2

### 4.1 Table: `users`

Stores registered user accounts.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique user identifier |
| `password` | `varchar(128)` | NOT NULL | PBKDF2-hashed password |
| `last_login` | `timestamp with time zone` | NULLABLE | Last login timestamp |
| `is_superuser` | `boolean` | NOT NULL, DEFAULT `false` | Django superuser flag |
| `email` | `varchar(254)` | NOT NULL, UNIQUE, INDEX | User email (used as username) |
| `role` | `varchar(20)` | NOT NULL, DEFAULT `'seeker'` | User role: `seeker`, `recruiter`, or `admin` |
| `is_verified` | `boolean` | NOT NULL, DEFAULT `false` | Email verified via OTP |
| `is_active` | `boolean` | NOT NULL, DEFAULT `true` | Account active status |
| `is_staff` | `boolean` | NOT NULL, DEFAULT `false` | Django staff flag |
| `date_joined` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Registration timestamp |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Record creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Record update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `email`

**Model Definition** (`accounts/models/user.py`):
```python
class CustomUser(AbstractBaseUser, PermissionsMixin):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='seeker')
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['role']
```

### 4.2 Table: `email_otps`

Stores one-time passwords for email verification and password reset.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique OTP identifier |
| `email` | `varchar(254)` | NOT NULL, INDEX | User email |
| `otp` | `varchar(6)` | NOT NULL | 6-digit OTP code |
| `purpose` | `varchar(20)` | NOT NULL | OTP purpose: `registration` or `password_reset` |
| `is_used` | `boolean` | NOT NULL, DEFAULT `false` | Whether OTP has been consumed |
| `expires_at` | `timestamp with time zone` | NOT NULL | OTP expiry (10 minutes from creation) |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Record creation timestamp |

**Indexes**:
- Primary key on `id`
- Index on `email`

**Model Definition** (`accounts/models/otp.py`):
```python
class EmailOTP(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField()
    otp = models.CharField(max_length=6)
    purpose = models.CharField(max_length=20, choices=PURPOSE_CHOICES)
    is_used = models.BooleanField(default=False)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## 5. Schema: profile_schema

**Owned by**: Profile Service (`backend/profile_service/`)  
**Purpose**: Seeker and recruiter profiles, skills, work experience, resume storage  
**Tables**: 6

### 5.1 Table: `seeker_profiles`

Stores job seeker profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique profile identifier |
| `user_id` | `uuid` | NOT NULL, UNIQUE, INDEX | Reference to auth_schema.users.id |
| `name` | `varchar(255)` | NULLABLE | Seeker's full name |
| `contact` | `varchar(50)` | NULLABLE | Phone number |
| `title` | `varchar(255)` | NULLABLE | Professional headline/title |
| `summary` | `text` | NULLABLE | Professional summary/bio |
| `github_url` | `varchar(500)` | NULLABLE | GitHub profile URL |
| `linkedin_url` | `varchar(500)` | NULLABLE | LinkedIn profile URL |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `user_id`
- Index on `user_id` for fast lookup

### 5.2 Table: `recruiter_profiles`

Stores recruiter/employer company information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique profile identifier |
| `user_id` | `uuid` | NOT NULL, UNIQUE, INDEX | Reference to auth_schema.users.id |
| `company_name` | `varchar(255)` | NULLABLE | Company name |
| `company_size` | `varchar(50)` | NULLABLE | Company size range (e.g., "1-10", "11-50") |
| `industry` | `varchar(100)` | NULLABLE | Industry sector |
| `headquarters` | `varchar(255)` | NULLABLE | Company HQ location |
| `website` | `varchar(500)` | NULLABLE | Company website URL |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `user_id`
- Index on `user_id`

### 5.3 Table: `skills`

Normalized skill names.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique skill identifier |
| `name` | `varchar(100)` | NOT NULL, UNIQUE | Skill name (unique, normalized) |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `name`

### 5.4 Table: `seeker_skills`

Many-to-many relationship between seekers and skills with experience level.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique identifier |
| `seeker_id` | `uuid` | NOT NULL, FK → seeker_profiles.id | Reference to seeker profile |
| `skill_id` | `uuid` | NOT NULL, FK → skills.id | Reference to skill |
| `years_of_experience` | `integer` | NULLABLE | Years of experience with this skill |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |

**Constraints**:
- UNIQUE `(seeker_id, skill_id)` — prevents duplicate skill assignments
- FK `seeker_id` → `seeker_profiles(id)` ON DELETE CASCADE
- FK `skill_id` → `skills(id)` ON DELETE CASCADE

### 5.5 Table: `experiences`

Work experience entries for job seekers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique experience identifier |
| `seeker_id` | `uuid` | NOT NULL, FK → seeker_profiles.id | Reference to seeker profile |
| `role` | `varchar(255)` | NOT NULL | Job title/role |
| `company` | `varchar(255)` | NOT NULL | Employer name |
| `start_date` | `date` | NOT NULL | Start date |
| `end_date` | `date` | NULLABLE | End date (NULL = current position) |
| `description` | `text` | NULLABLE | Role description |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- FK index on `seeker_id`

### 5.6 Table: `resumes`

Uploaded resume files and their metadata.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique resume identifier |
| `user_id` | `uuid` | NOT NULL, INDEX | Reference to auth_schema.users.id |
| `title` | `varchar(255)` | NULLABLE | Resume display name |
| `local_path` | `varchar(500)` | NOT NULL | File path on local storage |
| `file_size` | `integer` | NULLABLE | File size in bytes |
| `parsed_text` | `text` | NULLABLE | Extracted text content (via PyMuPDF) |
| `parsing_status` | `varchar(20)` | NOT NULL, DEFAULT `'pending'` | Status: `pending`, `completed`, `failed` |
| `is_primary` | `boolean` | NOT NULL, DEFAULT `false` | Whether this is the primary resume |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Upload timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Index on `user_id`

---

## 6. Schema: job_schema

**Owned by**: Job Service (`backend/job_service/`)  
**Purpose**: Job listings, categorization, skill requirements  
**Tables**: 3

### 6.1 Table: `jobs`

Core job listing table.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique job identifier |
| `recruiter_id` | `uuid` | NOT NULL, INDEX | Reference to auth_schema.users.id |
| `title` | `varchar(255)` | NOT NULL | Job title |
| `slug` | `varchar(300)` | NOT NULL, UNIQUE, INDEX | URL-friendly slug (title + UUID4[:8]) |
| `description` | `text` | NOT NULL | Job description |
| `location` | `varchar(255)` | NULLABLE | Job location |
| `location_type` | `varchar(20)` | NULLABLE, DEFAULT `'remote'` | `remote`, `onsite`, or `hybrid` |
| `salary_min` | `integer` | NULLABLE | Minimum salary |
| `salary_max` | `integer` | NULLABLE | Maximum salary |
| `experience_required` | `varchar(50)` | NULLABLE | Experience requirement text |
| `screening_questions` | `jsonb` | NULLABLE | JSON array of screening questions |
| `status` | `varchar(20)` | NOT NULL, DEFAULT `'draft'` | Status: `draft`, `published`, `closed`, `archived` |
| `published_at` | `timestamp with time zone` | NULLABLE | Publication timestamp |
| `closed_at` | `timestamp with time zone` | NULLABLE | Closure timestamp |
| `archived_at` | `timestamp with time zone` | NULLABLE | Archive timestamp |
| `restored_at` | `timestamp with time zone` | NULLABLE | Restore timestamp |
| `category_id` | `uuid` | NULLABLE, FK → job_categories.id | Job category reference |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `slug`
- Index on `recruiter_id`
- Index on `status` (filtered queries for active jobs)
- Index on `category_id`

**Screening Questions JSON structure**:
```json
[
    {
        "question": "How many years of Python experience do you have?",
        "required": true,
        "type": "text"
    },
    {
        "question": "Are you willing to relocate?",
        "required": true,
        "type": "boolean"
    }
]
```

### 6.2 Table: `job_categories`

Normalized job categories.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique category identifier |
| `name` | `varchar(100)` | NOT NULL, UNIQUE | Category name |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `name`

### 6.3 Table: `job_skills`

Many-to-many relationship between jobs and required skills.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique identifier |
| `job_id` | `uuid` | NOT NULL, FK → jobs.id | Reference to job |
| `skill_id` | `uuid` | NOT NULL, FK → profile_schema.skills.id | Reference to skill |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |

**Note**: The FK to `profile_schema.skills.id` is a cross-schema reference. In Django, this is modeled as a regular `UUID` field without a formal FK constraint (true microservice isolation).

---

## 7. Schema: app_schema

**Owned by**: Application Service (`backend/application_service/`)  
**Purpose**: Job applications, interview scheduling  
**Tables**: 2

### 7.1 Table: `applications`

Job application records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique application identifier |
| `job_id` | `uuid` | NOT NULL, INDEX | Reference to job_schema.jobs.id |
| `seeker_id` | `uuid` | NOT NULL, INDEX | Reference to profile_schema.seeker_profiles.id |
| `resume_id` | `uuid` | NULLABLE | Reference to profile_schema.resumes.id |
| `stage` | `varchar(30)` | NOT NULL, DEFAULT `'applied'` | Stage: `applied`, `shortlisted`, `interview_scheduled`, `selected`, `rejected` |
| `cover_letter` | `text` | NULLABLE | Cover letter text |
| `screening_answers` | `jsonb` | NULLABLE | JSON array of answers to screening questions |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Index on `job_id`
- Index on `seeker_id`
- Index on `stage`

**Screening Answers JSON structure**:
```json
[
    {
        "question": "How many years of Python experience do you have?",
        "answer": "5 years"
    },
    {
        "question": "Are you willing to relocate?",
        "answer": "Yes"
    }
]
```

### 7.2 Table: `interviews`

Scheduled interviews associated with applications.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique interview identifier |
| `application_id` | `uuid` | NOT NULL, UNIQUE, FK → applications.id | Reference to application (one interview per application) |
| `scheduled_at` | `timestamp with time zone` | NOT NULL | Scheduled interview datetime |
| `jitsi_link` | `varchar(500)` | NULLABLE | Auto-generated Jitsi Meet video link |
| `notes` | `text` | NULLABLE | Interview notes |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `application_id`
- FK `application_id` → `applications(id)` ON DELETE CASCADE

---

## 8. Schema: match_schema

**Owned by**: Matching Service (`backend/matching_service/`)  
**Purpose**: Vector embeddings for AI-powered semantic matching  
**Tables**: 2

### 8.1 Table: `job_embeddings`

384-dimensional vector embeddings for job postings.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique embedding identifier |
| `job_id` | `uuid` | NOT NULL, UNIQUE, INDEX | Reference to job_schema.jobs.id |
| `embedding` | `vector(384)` | NOT NULL | 384-dim float vector from Sentence Transformers |
| `model_version` | `varchar(50)` | NULLABLE, DEFAULT `'all-MiniLM-L6-v2'` | Model used for generation |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `job_id`
- Index on `job_id` for fast lookup
- IVFFlat index on `embedding` for approximate nearest neighbor search (pending)

**Model Definition** (`matching/models/job_embedding.py`):
```python
class JobEmbedding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_id = models.UUIDField(unique=True, db_index=True)
    embedding = VectorField(dimensions=384)
    model_version = models.CharField(max_length=50, default='all-MiniLM-L6-v2')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

### 8.2 Table: `resume_embeddings`

384-dimensional vector embeddings for resume content.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique embedding identifier |
| `seeker_id` | `uuid` | NOT NULL, UNIQUE, INDEX | Reference to profile_schema.seeker_profiles.id |
| `embedding` | `vector(384)` | NOT NULL | 384-dim float vector from Sentence Transformers |
| `model_version` | `varchar(50)` | NULLABLE, DEFAULT `'all-MiniLM-L6-v2'` | Model used for generation |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Unique index on `seeker_id`
- Index on `seeker_id`
- IVFFlat index on `embedding` (pending)

**Model Definition** (`matching/models/resume_embedding.py`):
```python
class ResumeEmbedding(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker_id = models.UUIDField(unique=True, db_index=True)
    embedding = VectorField(dimensions=384)
    model_version = models.CharField(max_length=50, default='all-MiniLM-L6-v2')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

---

## 9. Schema: notification_schema

**Owned by**: Notification Service (`backend/notification_service/`)  
**Purpose**: In-app notifications for users  
**Tables**: 1

### 9.1 Table: `notifications`

Stores user notifications generated from Kafka events.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique notification identifier |
| `user_id` | `uuid` | NOT NULL, INDEX | Reference to auth_schema.users.id |
| `type` | `varchar(50)` | NOT NULL | Notification type: `application_stage_changed`, `interview_scheduled`, `new_message`, `job_published`, etc. |
| `title` | `varchar(255)` | NOT NULL | Notification title |
| `body` | `text` | NOT NULL | Notification body text |
| `payload` | `jsonb` | NULLABLE | Additional data (e.g., job_id, application_id, conversation_id) |
| `is_read` | `boolean` | NOT NULL, DEFAULT `false` | Read status |
| `read_at` | `timestamp with time zone` | NULLABLE | When the notification was read |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |

**Indexes**:
- Primary key on `id`
- Index on `user_id` (filtered queries for user's notifications)
- Index on `(user_id, is_read)` (unread count queries)
- Index on `created_at` (ordering)

**Payload JSON structure**:
```json
{
    "job_id": "uuid",
    "job_title": "Senior Python Developer",
    "application_id": "uuid",
    "new_stage": "interview_scheduled",
    "scheduled_at": "2026-06-15T14:00:00Z"
}
```

---

## 10. Schema: chat_schema

**Owned by**: Chat Service (`backend/chat_service/`)  
**Purpose**: User-to-user messaging between recruiters and seekers  
**Tables**: 2

### 10.1 Table: `conversations`

Chat conversations between two users, scoped to a job posting.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique conversation identifier |
| `participant_a` | `uuid` | NOT NULL, INDEX | Reference to auth_schema.users.id (usually the seeker) |
| `participant_b` | `uuid` | NOT NULL, INDEX | Reference to auth_schema.users.id (usually the recruiter) |
| `job_id` | `uuid` | NULLABLE | Reference to job_schema.jobs.id |
| `job_title` | `varchar(255)` | NULLABLE | Denormalized job title for display |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Creation timestamp |
| `updated_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Update timestamp |

**Indexes**:
- Primary key on `id`
- Index on `participant_a`
- Index on `participant_b`
- Composite index on `(participant_a, participant_b, job_id)` for unique conversation lookup

### 10.2 Table: `messages`

Individual messages within a conversation.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `uuid` | PK, DEFAULT `uuid_generate_v4()` | Unique message identifier |
| `conversation_id` | `uuid` | NOT NULL, FK → conversations.id | Reference to conversation |
| `sender_id` | `uuid` | NOT NULL | Reference to auth_schema.users.id |
| `body` | `text` | NOT NULL | Message content |
| `created_at` | `timestamp with time zone` | NOT NULL, DEFAULT `now()` | Message timestamp |

**Indexes**:
- Primary key on `id`
- FK index on `conversation_id`
- Index on `created_at` (ordering within conversation)

---

## 11. Entity Relationship Overview

### 11.1 Logical Relationships (No Formal Foreign Keys)

Since services are isolated, cross-schema relationships are logical (not enforced by the database):

```
auth_schema.users
  │
  ├── 1:1 → profile_schema.seeker_profiles (via user_id)
  ├── 1:1 → profile_schema.recruiter_profiles (via user_id)
  ├── 1:N → profile_schema.resumes (via user_id)
  ├── 1:N → job_schema.jobs (via recruiter_id)
  ├── 1:N → notification_schema.notifications (via user_id)
  ├── 1:N → chat_schema.conversations (via participant_a/participant_b)
  └── 1:N → chat_schema.messages (via sender_id)

profile_schema.seeker_profiles
  ├── 1:N → profile_schema.experiences (via seeker_id)
  ├── M:N → profile_schema.skills → seeker_skills (via seeker_id)
  ├── 1:N → app_schema.applications (via seeker_id)
  └── 1:1 → match_schema.resume_embeddings (via seeker_id)

job_schema.jobs
  ├── M:N → profile_schema.skills → job_skills (via job_id)
  ├── 1:N → app_schema.applications (via job_id)
  ├── 1:1 → match_schema.job_embeddings (via job_id)
  └── 1:N → chat_schema.conversations (via job_id)

app_schema.applications
  └── 1:1 → app_schema.interviews (via application_id)

chat_schema.conversations
  └── 1:N → chat_schema.messages (via conversation_id)
```

### 11.2 Referenced Tables Summary

| Entity | Referenced By (as logical FK) | Nature |
|--------|------------------------------|--------|
| `auth_schema.users` | seeker_profiles, recruiter_profiles, resumes, jobs, notifications, conversations, messages | 1:N to many tables |
| `profile_schema.seeker_profiles` | seeker_skills, experiences, applications, resume_embeddings | 1:N to child tables |
| `profile_schema.skills` | seeker_skills, job_skills | M:N via junction tables |
| `job_schema.jobs` | job_skills, applications, conversations, job_embeddings | 1:N to child tables |
| `app_schema.applications` | interviews | 1:1 |

---

## 12. Design Decisions

### 12.1 Why UUID Primary Keys?

| Benefit | Explanation |
|---------|-------------|
| **Distributed-friendly** | UUIDs can be generated independently by any service without coordination |
| **No ID guessing** | Sequential integer IDs allow enumeration; UUIDs prevent this |
| **Microservice isolation** | No dependency on a central ID sequence |
| **Merging possible** | Tables from different environments can be merged without conflicts |

### 12.2 Why JSON Fields?

Three tables use `JSONField`:
- `jobs.screening_questions` — Flexible question structures without schema changes
- `applications.screening_answers` — Answers match questions dynamically
- `notifications.payload` — Variable payload per notification type

**Alternative considered**: Separate `screening_questions` and `screening_answers` tables with 1:N relationships. JSON was chosen because:
- Questions are tightly coupled to jobs (rarely queried independently)
- JSON avoids joins for read-heavy operations
- Changes to question structure don't require migrations

### 12.3 Why Schema-per-Service Instead of Separate Databases?

| Consideration | Decision |
|---------------|----------|
| **Operational simplicity** | Single `pg_dump` backs up everything |
| **Migration path** | Schemas can be moved to separate databases without code changes |
| **Cross-schema queries** | Enabled for AI review (controlled, read-only) |
| **Isolation** | Services access their schema via `search_path` in `OPTIONS` |
| **Scale ceiling** | At very high scale, migrate to separate DB instances |

### 12.4 Why No Cross-Schema Foreign Keys?

True microservice isolation means:
- Services don't create FK constraints to other services' tables
- References are stored as plain `UUID` columns
- Services validate references at the application layer
- Enables easy migration to separate databases
- Prevents cascading failures across schema boundaries

### 12.5 Why pgvector Over a Separate Vector Database?

| Factor | pgvector | Pinecone/Weaviate |
|--------|----------|-------------------|
| **Network latency** | None (same DB) | Additional hop |
| **Operational complexity** | Single DB to manage | Additional service |
| **ACID compliance** | Full transactional support | Eventual consistency |
| **Cost** | No additional infrastructure | Per-query costs |
| **Scale limit** | ~100K vectors with IVFFlat | Unlimited |
| **Backup/restore** | Single `pg_dump` | Separate export process |

For the current scale (~10K jobs and seekers), pgvector is the optimal choice.

---

## 13. Migration Strategy

### 13.1 Creating Migrations

```bash
# After model changes in any service
cd backend/auth_service
python manage.py makemigrations

cd backend/profile_service
python manage.py makemigrations

# etc. for each service
```

### 13.2 Applying Migrations

```bash
# Apply migrations for each service (order matters for dependencies)
cd backend/auth_service && python manage.py migrate
cd backend/profile_service && python manage.py migrate
cd backend/job_service && python manage.py migrate
cd backend/application_service && python manage.py migrate
cd backend/matching_service && python manage.py migrate
cd backend/notification_service && python manage.py migrate
cd backend/chat_service && python manage.py migrate
```

### 13.3 Migration Files

| Service | Migrations | Description |
|---------|-----------|-------------|
| Auth Service | `0001_initial.py` | Create users and email_otps tables |
| Profile Service | `0001_initial.py`, `0002_rename_s3_key_resume_local_path.py` | Create all 6 tables; rename S3 to local storage |
| Job Service | `0001_initial.py`, `0002_job_archival_fields.py`, `0003_job_screening_questions.py` | Create jobs, categories, job_skills; add archiving; add screening questions |
| Application Service | `0001_initial.py`, `0002_application_contact_fields.py`, `0003_application_screening_answers_and_more.py` | Create applications, interviews; add contact fields; add screening answers |
| Matching Service | `0001_initial.py`, `0002_alter_jobembedding_embedding_and_more.py` | Create embedding tables; alter vector field |
| Notification Service | `0001_initial.py` | Create notifications table |
| Chat Service | `0001_initial.py`, `0002_conversation_job_id_conversation_job_title.py` | Create conversations, messages; add job fields |

### 13.4 Migration Ordering

Migrations should be applied in dependency order:
1. Auth Service (no external dependencies)
2. Profile Service (depends on auth_schema.users logically)
3. Job Service (depends on profile_schema.skills logically)
4. Application Service (depends on job, profile schemas logically)
5. Matching Service (depends on job, profile schemas logically)
6. Notification Service (depends on auth_schema.users logically)
7. Chat Service (depends on auth_schema.users, job_schema.jobs logically)

---

## 14. Common Queries

### 14.1 Seeker Profile with Skills and Experience (Cross-Schema)

```sql
SELECT 
    sp.name, sp.title, sp.summary,
    array_agg(DISTINCT s.name) AS skills,
    json_agg(json_build_object(
        'role', e.role,
        'company', e.company,
        'start_date', e.start_date,
        'end_date', e.end_date
    ) ORDER BY e.start_date DESC) AS experiences
FROM profile_schema.seeker_profiles sp
LEFT JOIN profile_schema.seeker_skills ss ON ss.seeker_id = sp.id
LEFT JOIN profile_schema.skills s ON s.id = ss.skill_id
LEFT JOIN profile_schema.experiences e ON e.seeker_id = sp.id
WHERE sp.user_id = %s
GROUP BY sp.id;
```

### 14.2 Active Jobs with Category and Skills

```sql
SELECT j.*, jc.name AS category_name,
    array_agg(s.name) AS skills
FROM job_schema.jobs j
LEFT JOIN job_schema.job_categories jc ON jc.id = j.category_id
LEFT JOIN job_schema.job_skills js ON js.job_id = j.id
LEFT JOIN profile_schema.skills s ON s.id = js.skill_id
WHERE j.status = 'published'
GROUP BY j.id, jc.name
ORDER BY j.created_at DESC;
```

### 14.3 Vector Similarity Search (pgvector)

```sql
-- Find top 10 jobs matching a seeker's resume embedding
SELECT je.job_id, j.title, j.description,
    1 - (je.embedding <=> %s) AS similarity
FROM match_schema.job_embeddings je
JOIN job_schema.jobs j ON j.id = je.job_id
WHERE j.status = 'published'
ORDER BY je.embedding <=> %s
LIMIT 10;

-- Alternative using CosineDistance
SELECT je.job_id, j.title,
    CosineDistance(je.embedding, %s) AS distance
FROM match_schema.job_embeddings je
JOIN job_schema.jobs j ON j.id = je.job_id
WHERE j.status = 'published'
ORDER BY distance
LIMIT 10;
```

### 14.4 Unread Notification Count

```sql
SELECT COUNT(*)
FROM notification_schema.notifications
WHERE user_id = %s
  AND is_read = false;
```

### 14.5 User's Conversations with Last Message

```sql
SELECT c.*, 
    m.body AS last_message,
    m.created_at AS last_message_at,
    (SELECT COUNT(*) FROM chat_schema.messages 
     WHERE conversation_id = c.id 
       AND sender_id != %s) AS unread_count
FROM chat_schema.conversations c
LEFT JOIN LATERAL (
    SELECT body, created_at
    FROM chat_schema.messages
    WHERE conversation_id = c.id
    ORDER BY created_at DESC
    LIMIT 1
) m ON true
WHERE c.participant_a = %s OR c.participant_b = %s
ORDER BY m.created_at DESC NULLS LAST;
```

### 14.6 Application Stage Distribution

```sql
SELECT stage, COUNT(*) AS count
FROM app_schema.applications
WHERE job_id = %s
GROUP BY stage
ORDER BY count DESC;
```

---

## 15. Performance Notes

### 15.1 Index Strategy

| Table | Index Type | Columns | Purpose |
|-------|-----------|---------|---------|
| `users` | B-tree | `email` (unique) | Fast login by email |
| `jobs` | B-tree | `slug` (unique) | Fast URL lookup |
| `jobs` | B-tree | `status` | Filter active jobs |
| `notifications` | B-tree | `(user_id, is_read)` | Unread count query |
| `resume_embeddings` | B-tree | `seeker_id` (unique) | Fast embedding lookup |
| `job_embeddings` | B-tree | `job_id` (unique) | Fast embedding lookup |
| `resume_embeddings` | IVFFlat | `embedding` | Approximate nearest neighbor search |
| `job_embeddings` | IVFFlat | `embedding` | Approximate nearest neighbor search |

### 15.2 Query Optimization

- **N+1 Prevention**: Job DAO uses `select_related('category')` and `prefetch_related('skill_set')` for job listings
- **JSON Field Queries**: Screening questions/answers are stored as JSON; application-level parsing avoids expensive JSONB operators
- **Vector Search**: CosineDistance function used for semantic similarity; IVFFlat index supported for large-scale approximate search
- **Connection Pooling**: Django's default `CONN_MAX_AGE` reuses database connections to reduce connection overhead

### 15.3 Scaling Considerations

| Scale Level | Action |
|-------------|--------|
| **1K-10K users** | Current architecture — single PostgreSQL instance with 7 schemas |
| **10K-100K users** | Add IVFFlat indexes on embedding columns; optimize cache TTLs; add read replicas |
| **100K-1M users** | Migrate to separate PostgreSQL instances per schema; implement connection pooling with PgBouncer |
| **1M+ users** | Shard by schema or geographic region; implement read replicas with load balancing; consider CitusDB |

---

## Appendix: Django Model Files Reference

| Model | File | Lines |
|-------|------|-------|
| CustomUser | `auth_service/accounts/models/user.py` | 43 |
| EmailOTP | `auth_service/accounts/models/otp.py` | 17 |
| All Profile Models | `profile_service/profiles/models/__init__.py` | 90 |
| Job + Category + Skill | `job_service/jobs/models/job.py` | 59 |
| Application + Interview | `application_service/applications/models/application.py` | 75 |
| ResumeEmbedding | `matching_service/matching/models/resume_embedding.py` | 16 |
| JobEmbedding | `matching_service/matching/models/job_embedding.py` | 15 |
| Notification | `notification_service/notifications/models/notification.py` | 26 |
| Conversation + Message | `chat_service/chat/models.py` | 27 |

---

*This database schema document is part of the Job Buddy project. See [README.md](../README.md) for the full project overview.*
