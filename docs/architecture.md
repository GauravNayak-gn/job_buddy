# Job Portal — System Architecture

## What We Are Building

A job portal where:
- **Seekers** register, build a profile, upload a resume, browse jobs, apply, and attend interviews
- **Recruiters** post jobs, review applications, move candidates through stages, and schedule Jitsi interviews
- **Admins** manage users and content via Django's built-in admin panel

---

## Tech Stack at a Glance

| Layer | Technology |
|---|---|
| Frontend | Angular (Single Repo) |
| Backend Services | Django REST Framework (7 services) |
| Primary Database | PostgreSQL (schema-per-service) |
| Vector Database | pgvector extension on same PostgreSQL |
| File Storage | AWS S3 (resume PDFs) |
| Message Broker | Apache Kafka |
| Cache / Sessions | Redis |
| Reverse Proxy | Nginx |
| Containerization | Docker + Docker Compose |
| Email | Gmail SMTP via Django |
| AI Matching | Sentence Transformers (all-MiniLM-L6-v2, runs locally) |
| Video Interviews | Jitsi Meet (meet.jit.si, free, no API key) |

---

## The 7 Microservices

```
┌─────────────────────────────────────────────────────────────┐
│                        Angular Frontend                      │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP Requests
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    Nginx (Reverse Proxy)                     │
│              Routes /api/auth → Auth Service                 │
│              Routes /api/profile → Profile Service           │
│              Routes /api/jobs → Job Service  ... etc         │
└─────────────────────────┬───────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
    Auth Service    Profile Service   Job Service
    (port 8001)     (port 8002)       (port 8003)
          │               │               │
          └───────────────┼───────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
  Application Svc   Matching Svc   Notification Svc
   (port 8004)       (port 8005)     (port 8006)
                                         │
                                   Chat Svc (placeholder)
                                     (port 8007)
```

All services share one PostgreSQL server but use separate schemas.
All services connect to the same Redis and Kafka cluster.

---

## Service Responsibilities

### 1. Auth Service (port 8001)
- Register (seeker or recruiter)
- Login → returns JWT access + refresh token
- Email OTP verification on registration
- Password reset via email
- Token refresh endpoint
- All other services validate JWT by calling Auth Service or using shared secret

### 2. Profile Service (port 8002)
- Seeker: create/update profile (name, title, summary, github, linkedin)
- Seeker: add skills, work experience
- Seeker: upload resume PDF → stored in S3, text extracted using PyMuPDF
- Extracted resume text is published to Kafka → Matching Service picks it up
- Recruiter: create/update company profile

### 3. Job Service (port 8003)
- Recruiter: create, edit, publish, close job listings
- Anyone: browse/search/filter jobs
- When a job is published → Kafka event sent → Matching Service generates job embedding

### 4. Application Service (port 8004)
- Seeker applies to a job (attaches resume)
- Recruiter views all applications for their job
- Recruiter moves application stage: Applied → Screening → Interview → Offered → Rejected
- Recruiter schedules interview: picks date/time → system generates Jitsi room link
- Jitsi link = `https://meet.jit.si/<unique-uuid-room>`
- Link is stored with scheduled time, expires after the scheduled slot passes
- Every stage change → Kafka event → Notification Service sends email

### 5. Matching Service (port 8005)
- Listens to Kafka for resume uploads and job publications
- Uses Sentence Transformers (all-MiniLM-L6-v2) to generate 384-dimension vectors
- Stores vectors in pgvector tables
- Exposes endpoint: `GET /match/jobs-for-seeker/<seeker_id>` → top 10 matching jobs
- Exposes endpoint: `GET /match/seekers-for-job/<job_id>` → top 10 matching resumes

### 6. Notification Service (port 8006)
- Pure Kafka consumer — no REST API exposed to frontend
- Listens to topics: `application.stage_changed`, `interview.scheduled`, `user.registered`
- Sends emails via Gmail SMTP using Django's email backend
- Stores all notifications in DB (in-app bell icon)
- Frontend polls `GET /notifications/` for unread count and list

### 7. Chat Service — Placeholder (port 8007)
- Basic Django app with models for Conversation and Message
- REST endpoints stubbed out
- WebSocket support structure in place (Django Channels)
- Not fully functional but shows architecture understanding

---

## Database Strategy — Schema Per Service

One PostgreSQL server, 7 schemas:

```
PostgreSQL Server
├── auth_schema        ← Auth Service owns this
├── profile_schema     ← Profile Service owns this
├── job_schema         ← Job Service owns this
├── app_schema         ← Application Service owns this
├── match_schema       ← Matching Service owns this (pgvector here)
├── notification_schema← Notification Service owns this
└── chat_schema        ← Chat Service owns this
```

**Why this approach:**
- One DB server = low cost, easy to run on one laptop
- Separate schemas = services cannot accidentally query each other's tables
- No foreign keys across schemas — services communicate via Kafka events or REST calls
- Easy to split into separate DB servers later if needed (just change the connection string)

---

## How Services Talk to Each Other

There are two ways services communicate:

### A. Synchronous (REST API calls)
Used when the frontend needs an immediate response.

Example: Frontend asks Application Service for application details.
Application Service needs the job title (from Job Service) and seeker name (from Profile Service).
It makes internal HTTP calls to those services and assembles the response.

```
Frontend → Application Service → (internal) → Job Service
                               → (internal) → Profile Service
```

### B. Asynchronous (Kafka Events)
Used for background work where the user doesn't need to wait.

Example: Seeker uploads resume.
Profile Service saves the file to S3, extracts text, then publishes a Kafka message.
Matching Service picks it up in the background and generates the vector.
User doesn't wait for this — it happens behind the scenes.

```
Profile Service → Kafka Topic: resume.uploaded → Matching Service
```

---

## Kafka Topics

| Topic | Producer | Consumer | When |
|---|---|---|---|
| `user.registered` | Auth Service | Notification Service | New user signs up |
| `resume.uploaded` | Profile Service | Matching Service | Resume PDF uploaded |
| `job.published` | Job Service | Matching Service | Job goes live |
| `application.stage_changed` | Application Service | Notification Service | Stage updated |
| `interview.scheduled` | Application Service | Notification Service | Interview booked |

---

## Redis Usage

| Use Case | Details |
|---|---|
| JWT Blacklist | Stores invalidated tokens on logout |
| OTP Storage | Stores email OTP with 10-minute TTL |
| API Rate Limiting | Nginx + Redis to prevent spam |
| Caching | Job listings cached for 5 minutes (reduces DB hits) |
| Celery Broker | Background tasks use Redis as broker |

---

## S3 Usage

Only Profile Service uploads to S3.

```
Seeker uploads PDF
    → Profile Service receives file
    → Validates it is a real readable PDF (PyMuPDF check)
    → Uploads to S3 bucket under path: resumes/<seeker_id>/<uuid>.pdf
    → Stores the S3 key in DB (not the full URL)
    → Generates pre-signed URL when seeker/recruiter needs to view it
```

---

## AI Matching — How It Actually Works

```
Step 1: Resume uploaded
    Profile Service extracts raw text from PDF using PyMuPDF
    Publishes to Kafka: { resume_id, seeker_id, raw_text }

Step 2: Matching Service receives Kafka message
    Feeds raw_text into Sentence Transformer model
    Gets back a 384-number vector (mathematical representation of the resume)
    Saves vector to match_schema.resume_embeddings

Step 3: Job published
    Job Service publishes to Kafka: { job_id, description_text }
    Matching Service generates vector for job description
    Saves to match_schema.job_embeddings

Step 4: Recruiter clicks "Find Matching Resumes" for Job #10
    Matching Service runs pgvector cosine similarity query:
    → Returns top 10 resumes most similar to that job

Step 5: Seeker visits "Jobs For You" page
    Matching Service compares seeker's resume vector against all job vectors
    → Returns top 10 most relevant jobs
```

The model (all-MiniLM-L6-v2) is downloaded once (~80MB), runs on your CPU, no internet needed after that, no API key, free forever.

---

## Jitsi Interview Flow

```
1. Recruiter opens Application #45, clicks "Schedule Interview"
2. Picks date: 2025-08-10, time: 3:00 PM
3. Application Service:
   - Generates a UUID: e.g., a3f9c2d1-...
   - Creates Jitsi link: https://meet.jit.si/jobportal-a3f9c2d1
   - Saves link + scheduled_at + expires_at (scheduled_at + 2 hours) to DB
   - Publishes Kafka event: interview.scheduled
4. Notification Service receives event:
   - Sends email to seeker with the link and time
   - Sends email to recruiter as confirmation
5. On interview day, both open the link in browser — no install needed
6. After expires_at, the link is marked expired in DB
   (The Jitsi room still technically works but your app won't show the link)
```

---

## Email — Not Going to Spam

To avoid Gmail spam issues:
- Use Gmail App Password (not your main password) — Google requires this for SMTP
- Set proper email subject lines (not spammy words)
- Send from a dedicated Gmail account for the project
- Django's `EMAIL_USE_TLS = True` ensures encrypted sending
- For college demo this is perfectly fine

---

## Full Request Flow Example — Seeker Applies to a Job

```
1. Seeker clicks "Apply" on Job #7 in Angular
2. Angular sends POST /api/applications/ with JWT token
3. Nginx routes to Application Service (port 8004)
4. Application Service:
   a. Validates JWT (checks signature with shared secret)
   b. Checks seeker has an uploaded resume (calls Profile Service internally)
   c. Creates application record in app_schema.applications
   d. Publishes Kafka event: application.stage_changed { stage: "Applied" }
5. Notification Service receives event:
   a. Looks up seeker email (calls Auth Service internally)
   b. Sends email: "Your application for [Job Title] has been received"
   c. Saves notification to notification_schema.notifications
6. Response returned to Angular: { application_id: 23, status: "Applied" }
7. Angular shows success toast
```

---

## Scalability (For Your Teacher)

Even though you're running on one laptop, the architecture is designed to scale:

- Each service is independent — you can run 3 instances of Application Service behind Nginx if traffic increases
- Kafka decouples producers and consumers — Notification Service can fall behind without affecting Application Service
- Redis caching reduces database load
- S3 handles file storage separately from compute
- pgvector queries are indexed — matching stays fast as data grows
- Schema-per-service means you can move any service to its own DB server by just changing one config line

---

## Folder Structure (Planned)

```
job-portal/
├── frontend/                  ← Angular app
├── services/
│   ├── auth_service/          ← Django project
│   ├── profile_service/       ← Django project
│   ├── job_service/           ← Django project
│   ├── application_service/   ← Django project
│   ├── matching_service/      ← Django project
│   ├── notification_service/  ← Django project
│   └── chat_service/          ← Django project (placeholder)
├── nginx/
│   └── nginx.conf
├── docs/
│   ├── architecture.md        ← This file
│   ├── database_schema.md
│   └── setup_guide.md
└── docker-compose.yml
```
