# Job Buddy — AI-Powered Job Portal Platform

> **A full-stack microservices job portal with AI-driven resume-job matching, real-time chat, and event-driven architecture.**  
> Built with 7 Django REST Framework microservices, Angular 20 SPA, PostgreSQL + pgvector, Apache Kafka, Redis, and Nginx API Gateway.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Features](#2-features)
3. [Tech Stack](#3-tech-stack)
4. [Architecture Overview](#4-architecture-overview)
5. [System Design](#5-system-design)
6. [Microservices Breakdown](#6-microservices-breakdown)
7. [API Reference](#7-api-reference)
8. [Database Design](#8-database-design)
9. [Frontend Architecture](#9-frontend-architecture)
10. [AI/ML Pipeline](#10-aiml-pipeline)
11. [Event-Driven Architecture](#11-event-driven-architecture)
12. [Security](#12-security)
13. [Performance & Caching](#13-performance--caching)
14. [Setup & Installation](#14-setup--installation)
15. [Usage Guide](#15-usage-guide)
16. [Testing](#16-testing)
17. [Deployment](#17-deployment)
18. [Project Structure](#18-project-structure)
19. [Contributing](#19-contributing)
20. [License](#20-license)

---

## 1. Overview

**Job Buddy** is a comprehensive job portal platform that connects **job seekers** and **recruiters** through an intelligent, AI-powered matching system. The platform goes beyond traditional keyword-based search by using **semantic embeddings** and **vector similarity search** to find the best matches between resumes and job postings.

### Business Problem Solved

- **For Seekers**: Upload a PDF resume once and get AI-ranked job matches, apply with a single click, track application stages, and chat with recruiters.
- **For Recruiters**: Post jobs, receive AI-ranked candidate matches, review detailed alignment reports, schedule interviews with auto-generated Jitsi video links, and manage the hiring pipeline.
- **For Admins**: Full visibility into users, jobs, and platform health.

### Key Differentiators

- Semantic AI matching (not keyword-based)
- Multi-provider AI alignment reviews (Gemini + OpenAI/OpenRouter)
- RAG chatbot for job-market queries
- Event-driven architecture with Kafka + Celery fallback
- Schema-per-service database isolation
- Real-time chat with unread polling
- Jitsi Meet integration for video interviews
- Dark mode with system preference detection

---

## 2. Features

### Authentication & User Management

| Feature | Description |
|---------|-------------|
| User Registration | Email + password with role selection (seeker/recruiter/admin) |
| Email OTP Verification | 6-digit OTP sent via Gmail SMTP with Redis + DB fallback |
| JWT Authentication | Access token (60 min) + refresh token (7 days), role embedded in payload |
| Token Blacklisting | Server-side logout via SimpleJWT blacklist + Redis fallback |
| Password Reset | Forgot password flow with OTP verification |
| Login Rate Limiting | 5 attempts/minute per IP+email combination via Redis |

### Seeker Features

| Feature | Description |
|---------|-------------|
| Profile Management | Name, contact info, title, summary, GitHub, LinkedIn URLs |
| Skill Management | Add skills with years of experience, auto-deduplication |
| Experience Management | Role title, company, dates, description per position |
| Resume Upload | PDF upload with PyMuPDF text extraction |
| Multiple Resumes | Upload multiple resumes, set primary, download with access control |
| Job Search | Browse/filter active job listings |
| AI Job Matching | Top 10 semantically matched jobs based on resume embedding |
| Apply to Jobs | Submit applications with resume selection and screening answers |
| Track Applications | View application stage status throughout the pipeline |
| Chat with Recruiters | Real-time conversation per job posting |
| AI Alignment Reviews | Detailed match analysis with strengths, gaps, interview questions |
| AI Chatbot (RAG) | Ask questions about jobs, skills, market trends |

### Recruiter Features

| Feature | Description |
|---------|-------------|
| Profile Management | Company name, size, industry, headquarters, website |
| Job CRUD | Create, update, publish, close, archive, restore job listings |
| Job Categories | Categorize jobs for easier filtering |
| Screening Questions | Custom Q&A per job for pre-application screening |
| Candidate Matching | Top 10 semantically matched candidates per job |
| AI Alignment Reviews | Per-candidate detailed alignment analysis |
| Application Management | View applicants, update stages (shortlist, interview, select, reject) |
| Interview Scheduling | Schedule with datetime picker + auto Jitsi Meet link generation |
| Chat with Seekers | Conversation per applicant per job |
| Notifications | In-app notifications for application updates |

### AI & Matching

| Feature | Description |
|---------|-------------|
| Semantic Embeddings | Sentence Transformers `all-MiniLM-L6-v2` generating 384-dim vectors |
| Vector Similarity Search | pgvector `CosineDistance` for semantic matching |
| Seeker-Job Matching | Top 10 jobs matching a seeker's resume |
| Job-Seeker Matching | Top 10 candidates matching a job posting |
| AI Alignment Review | LLM-powered detailed candidate-job alignment analysis |
| Multi-Provider AI | Gemini + OpenAI/OpenRouter/OpenCode support with configurable provider |
| RAG Chatbot | Semantic search + LLM response generation on job data |
| Deterministic Fallback | SHA-256 based deterministic embeddings when model unavailable |
| Embedding Sync | Management command to sync missing embeddings for existing data |

### Communication

| Feature | Description |
|---------|-------------|
| User Chat | Conversation between recruiter and seeker per job |
| Unread Indicators | Polling-based unread message detection (8-second interval) |
| Chat Message Events | Kafka event published on message sent |
| WebSocket Support | ASGI configuration for potential real-time upgrade |
| In-App Notifications | Create, list, mark read/unread, mark all read |
| Email Notifications | Gmail SMTP for application stage changes, interview scheduling |

### Platform

| Feature | Description |
|---------|-------------|
| Role-Based Access | Seeker/Recruiter/Admin permissions enforced per endpoint |
| Rate Limiting | Per-role throttle rates (anon: 100/d, seeker: 1000/d, recruiter: 5000/d, admin: 10000/d) |
| Redis Caching | Job list (5 min), categories (1 hr), AI reviews (24 hr) |
| Cache Invalidation | Pattern-based cache clearing on state changes |
| Health Endpoints | Every service has `/health/` for monitoring |
| Dark Mode | System preference + manual toggle, persisted in localStorage |
| Responsive UI | CSS grid, media queries, mobile-friendly layouts |
| Lazy Loading | All feature routes lazy-loaded in Angular |

---

## 3. Tech Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| Angular | 20.3.x | SPA framework with standalone components |
| Angular Material | 17.3.x | UI component library |
| TypeScript | 5.9.x | Typed frontend language |
| Angular CDK | 17.3.x | Component development kit |
| RxJS | 7.8.x | Reactive state, HTTP, polling |
| Angular Signals | built-in | Reactive state management (`signal`, `computed`, `effect`) |
| Angular Router | built-in | Lazy-loaded routes with functional guards |
| Angular HttpClient | built-in | API communication with JWT interceptor |
| SweetAlert2 | 11.x | User-facing alerts and confirmations |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| Python | 3.x | Backend language |
| Django | 5.2.12 | Web framework |
| Django REST Framework | 3.17.1 | REST API layer |
| SimpleJWT | latest | JWT token generation, refresh, blacklisting |
| Celery | 5.4.0 | Async task queue with Redis broker |
| Kafka-python | 2.3.0 | Event bus producer/consumer |
| PyJWT | 2.10.1 | Manual JWT decode in non-auth services |
| PyMuPDF (fitz) | latest | PDF text extraction from resumes |
| boto3 | latest | AWS S3 integration for resume storage |
| python-decouple | latest | Environment variable management via `.env` |
| django-cors-headers | latest | CORS configuration |
| Sentence Transformers | latest | Text embedding generation (`all-MiniLM-L6-v2`) |
| google-generativeai | latest | Gemini AI provider integration |
| psycopg2-binary | latest | PostgreSQL adapter |
| django-pgvector | latest | pgvector ORM integration |

### Database

| Technology | Purpose |
|------------|---------|
| PostgreSQL 16 | Primary relational database |
| pgvector | Vector similarity search extension (384-dim embeddings) |
| 7 Schemas | Schema-per-service isolation on single database |

### Infrastructure

| Technology | Version | Purpose |
|------------|---------|---------|
| Docker Compose | 3.9 | Container orchestration |
| Nginx | alpine | API Gateway / Reverse Proxy |
| Redis | 7-alpine | Caching, Celery broker, rate limiting, token blacklist |
| Apache Kafka | 7.6.0 | Event-driven messaging bus |
| Zookeeper | 7.6.0 | Kafka coordination |

---

## 4. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Angular 20 SPA                           │
│          (Standalone Components, Signals, RxJS)             │
└─────────────────────────┬───────────────────────────────────┘
                          │ HTTP /api/*
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Nginx API Gateway (port 80)                    │
│         CORS handling, request routing, proxy pass           │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬────────────────┘
   │      │      │      │      │      │      │
   ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐
│Auth │ │Prof.│ │ Job │ │ App │ │Match│ │Notif│ │Chat │
│:8001│ │:8002│ │:8003│ │:8004│ │:8005│ │:8006│ │:8007│
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │       │       │       │       │       │
   └───────┴───────┴───────┴───────┴───────┴───────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│              PostgreSQL + pgvector (jobportal_db)            │
│  7 Schemas: auth, profile, job, app, match, notification,   │
│  chat                                                        │
└─────────────────────────────────────────────────────────────┘

                   Event Flow (Async):
┌─────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Service │───▶│   Apache Kafka   │───▶│  Other Services  │
│         │    │  (6+ event types)│    │  (consumers)     │
└─────────┘    └────────┬─────────┘    └─────────────────┘
                        │ Fallback
                        ▼
                  ┌─────────────┐
                  │  Celery     │
                  │  (retry+DB) │
                  └─────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     Redis Cache                               │
│  • Job listings (300s TTL)                                    │
│  • Categories (3600s TTL)                                     │
│  • AI reviews (86400s TTL)                                    │
│  • Token blacklist                                            │
│  • OTP storage                                                │
│  • Rate limiting counters                                     │
│  • Celery message broker                                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 5. System Design

### Design Patterns

| Pattern | Implementation |
|---------|---------------|
| **Microservices Architecture** | 7 independent Django services, each in its own bounded context |
| **API Gateway** | Nginx routes `/api/{service}/` to backend upstreams |
| **Service Layer** | `services/*.py` contains pure business logic |
| **DAO Layer** | `dao/*.py` encapsulates all database access |
| **Handler Layer** | `handlers/*.py` orchestrates multi-step operations |
| **Repository Pattern** | DAO classes abstract data access behind interfaces |
| **Singleton** | Kafka producer clients use singleton pattern for connection reuse |
| **Event-Driven Architecture** | Kafka topics for async service-to-service communication |
| **Fallback Chain** | Kafka → Celery → DB (3-layer resilience) |
| **Strategy Pattern** | AI service supports Gemini + OpenAI providers interchangeably |
| **Facade Pattern** | Angular `ApiService` wraps `HttpClient` for all API calls |
| **Observer Pattern** | RxJS Observables + Angular Signals for reactive state |

### Architecture Decisions

| Decision | Rationale |
|----------|-----------|
| Schema-per-service vs separate DBs | Single DB simplifies operations (backup, restore) while maintaining logical isolation; easy migration path to separate DBs |
| Kafka + Celery fallback | Kafka for real-time event streaming; Celery for guaranteed delivery during Kafka outages |
| Custom JWT auth in each service | Eliminates auth service bottleneck; each service validates tokens independently using shared SECRET_KEY |
| pgvector vs standalone vector DB | Zero network latency for similarity search; single DB to manage; sufficient for 10k-scale embeddings |
| Angular Signals vs NgRx | Framework-native, less boilerplate, integrated with change detection |
| Standalone components | Angular's future direction; no NgModules, less indirection, better tree-shaking |
| UUID primary keys | Distributed-friendly, no ID guessing, microservice isolation |
| JSON fields (screening questions, payload) | Flexible schema without migrations; avoids unnecessary joins |

---

## 6. Microservices Breakdown

### 6.1 Auth Service (`:8001`)

**Purpose**: User registration, authentication, token management, OTP verification.

**Key Files**:
- `accounts/models/user.py` — Custom User model (email as username, UUID PK, role field)
- `accounts/models/otp.py` — EmailOTP model with 6-digit code, purpose, expiry
- `accounts/services/auth_service.py` — Business logic: register, verify OTP, login with rate limiting, logout blacklist, password reset
- `accounts/services/email_service.py` — Gmail SMTP wrapper for sending OTP emails
- `accounts/services/kafka_client.py` — Singleton Kafka producer; publishes `user.registered` events
- `accounts/services/redis_client.py` — Redis wrapper for OTP storage, token blacklist, rate limiting
- `accounts/dao/user_dao.py` — User data access
- `accounts/dao/otp_dao.py` — OTP data access (create, verify, invalidate)
- `accounts/handlers/auth_handler.py` — Orchestrates registration flow (create user → send OTP → Kafka event)
- `accounts/api/views/auth.py` — 8 REST endpoints
- `accounts/api/serializers/auth.py` — Registration serializer with password validation

**Endpoints**: `/api/auth/register/`, `/api/auth/verify-otp/`, `/api/auth/login/`, `/api/auth/logout/`, `/api/auth/token/refresh/`, `/api/auth/forgot-password/`, `/api/auth/reset-password/`, `/api/auth/health/`

### 6.2 Profile Service (`:8002`)

**Purpose**: Seeker and recruiter profile management, skill management, experience tracking, resume upload/parsing.

**Key Files**:
- `profiles/models/__init__.py` — All models: `SeekerProfile`, `RecruiterProfile`, `Skill`, `SeekerSkill`, `Experience`, `Resume`
- `profiles/services/profile.py` — Profile CRUD business logic
- `profiles/services/resume.py` — Resume upload pipeline, access control, primary management
- `profiles/services/kafka_client.py` — Publishes `resume.uploaded` events for embedding generation
- `profiles/services/redis_client.py` — Cache wrapper
- `profiles/dao/profile.py` — Profile data access with flexible lookup (by ID or user_id)
- `profiles/dao/resume.py` — Resume data access with primary management
- `profiles/handlers/resume.py` — Orchestrates: upload → save → parse PDF → Kafka event
- `profiles/api/views/profile.py` — Seeker and recruiter endpoint views
- `profiles/api/views/resume.py` — Resume upload, list, download, set primary
- `profiles/utils.py` — File validation helper
- `profiles/utils_local.py` — Local file storage implementation

**Endpoints**: `/api/profile/seeker/`, `/api/profile/seeker/skills/`, `/api/profile/seeker/experiences/`, `/api/profile/seeker/resumes/`, `/api/profile/recruiter/`, `/api/profile/health/`

### 6.3 Job Service (`:8003`)

**Purpose**: Job CRUD, categorization, search/filter, status workflow (draft → published → closed/archived).

**Key Files**:
- `jobs/models/job.py` — `Job` model (title, slug, description, location, salary, experience, status, screening questions JSON, category FK, skills M2M)
- `jobs/dao/job_dao.py` — Data access with `select_related` and `prefetch_related` for N+1 prevention
- `jobs/services/job_service.py` — Business logic with status transitions and cache invalidation
- `jobs/services/kafka_client.py` — Publishes `job.published` events
- `jobs/services/redis_client.py` — Cache for job listings and categories
- `jobs/api/views/job_views.py` — 10+ REST endpoints
- `jobs/api/serializers/job_serializers.py` — Job serialization with skills and category
- `jobs/tasks/celery_tasks.py` — Email notifications for job status changes
- `jobs/tasks/kafka_tasks.py` — Kafka consumer for job-related events

**Endpoints**: `/api/jobs/`, `/api/jobs/create/`, `/api/jobs/my/`, `/api/jobs/categories/`, `/api/jobs/:id/`, `/api/jobs/:id/publish/`, `/api/jobs/:id/close/`, `/api/jobs/:id/archive/`, `/api/jobs/:id/restore/`, `/api/jobs/health/`

### 6.4 Application Service (`:8004`)

**Purpose**: Job application submission, stage management (applied → shortlisted → interview_scheduled → selected/rejected), interview scheduling with Jitsi Meet.

**Key Files**:
- `applications/models/application.py` — `Application` model (job, seeker, resume, stage, cover letter, screening answers JSON); `Interview` model (scheduled_at, jitsi_link, notes)
- `applications/dao/application_dao.py` — Data access for applications and interviews
- `applications/services/application_service.py` — Business logic for stage transitions
- `applications/services/kafka_client.py` — Publishes `application.stage_changed` and `interview.scheduled` events
- `applications/services/redis_client.py` — Cache wrapper
- `applications/services/job_service_client.py` — Internal REST client to fetch job details from Job Service
- `applications/handlers/application_handler.py` — Orchestrates: validate → create application → screen questions → publish events
- `applications/api/views/application_views.py` — 6 REST endpoints
- `applications/tasks/events.py` — Event definitions for Kafka
- `applications/tasks/celery_tasks.py` — Async email notifications

**Endpoints**: `/api/applications/apply/`, `/api/applications/my/`, `/api/applications/job/:id/`, `/api/applications/:id/stage/`, `/api/applications/:id/schedule-interview/`, `/api/applications/health/`

### 6.5 Matching Service (`:8005`)

**Purpose**: AI embedding generation, pgvector similarity search, AI alignment reviews, RAG chatbot.

**Key Files**:
- `matching/models/resume_embedding.py` — `ResumeEmbedding` (seeker_id, embedding VectorField(384), model_version)
- `matching/models/job_embedding.py` — `JobEmbedding` (job_id, embedding VectorField(384), model_version)
- `matching/services/embedding_service.py` — Sentence Transformers embedding generation
- `matching/services/matching_service.py` — Business logic for finding matches
- `matching/services/ai_service.py` — Multi-provider AI: Gemini, OpenAI/OpenRouter, realistic fallback simulation (295 lines, most complex service file)
- `matching/services/kafka_client.py` — Kafka consumer with DLQ (Dead Letter Queue) support
- `matching/services/redis_client.py` — Cache for matches and AI reviews
- `matching/dao/resume_dao.py` — Resume embedding CRUD with pgvector
- `matching/dao/job_dao.py` — Job embedding CRUD with `CosineDistance` annotation
- `matching/utils.py` — Sentence Transformer singleton, vector serialization helpers, deterministic embedding fallback
- `matching/api/views/embeddings.py` — Embedding upsert endpoints
- `matching/api/views/matching.py` — Match query endpoints
- `matching/api/views/ai_views.py` — AI alignment review and chatbot endpoints (cross-schema raw SQL)
- `matching/management/commands/consume_events.py` — Kafka consumer command for processing resume/job embedding events
- `sync_embeddings.py` — Standalone script to sync missing embeddings
- `check_matching_db.py` — Diagnostic script for matching schema

**Endpoints**: `/api/match/embed/resume/`, `/api/match/embed/job/`, `/api/match/jobs-for-seeker/:id/`, `/api/match/seekers-for-job/:id/`, `/api/match/ai-review/`, `/api/match/chat/`, `/api/match/health/`

### 6.6 Notification Service (`:8006`)

**Purpose**: In-app notification storage, email dispatch via Kafka consumer, notification management.

**Key Files**:
- `notifications/models/notification.py` — `Notification` model (user_id, type, title, body, payload JSON, is_read, read_at)
- `notifications/dao/notification_dao.py` — Data access with filtering and pagination
- `notifications/services/notification_service.py` — Create, list, mark read business logic
- `notifications/services/kafka_client.py` — Kafka consumer with DLQ support; processes all event types
- `notifications/services/redis_client.py` — Cache for notification counts
- `notifications/api/views/notification.py` — 4 REST endpoints
- `notifications/management/commands/consume_events.py` — Kafka consumer command with event type routing (129 lines, complex event processing)

**Endpoints**: `/api/notifications/`, `/api/notifications/unread-count/`, `/api/notifications/:id/mark-read/`, `/api/notifications/mark-all-read/`

### 6.7 Chat Service (`:8007`)

**Purpose**: Real-time conversation management between recruiters and seekers per job posting.

**Key Files**:
- `chat/models.py` — `Conversation` (participant_a, participant_b, job_id, job_title) and `Message` (sender, body, conversation FK)
- `chat/views.py` — REST endpoints for conversations and messages
- `chat/serializers.py` — Message serialization with user details
- `chat/consumers.py` — WebSocket consumer (ASGI configuration exists for future upgrade)
- `chat/services/kafka_client.py` — Publishes `chat.message_sent` events
- `chat/services/redis_client.py` — Cache for conversation data
- `chat/tasks/celery_tasks.py` — Async notification tasks
- `chat_service/middleware.py` — Custom middleware for request processing
- `chat_service/asgi.py` — ASGI configuration with WebSocket routing

**Endpoints**: `/api/chat/conversations/`, `/api/chat/conversations/:id/messages/`, `/api/chat/health/`, `/api/chat/ws/` (WebSocket)

---

## 7. API Reference

### 7.1 Auth Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/auth/health/` | None | Service health check |
| POST | `/api/auth/register/` | None | Register new user (email, password, role) |
| POST | `/api/auth/verify-otp/` | None | Verify email with 6-digit OTP |
| POST | `/api/auth/login/` | None | Login with rate limiting (5/min per IP+email) |
| POST | `/api/auth/logout/` | JWT | Logout + blacklist refresh token |
| POST | `/api/auth/token/refresh/` | None | Refresh expired access token |
| POST | `/api/auth/forgot-password/` | None | Request password reset OTP |
| POST | `/api/auth/reset-password/` | None | Reset password with OTP |

### 7.2 Profile Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/profile/health/` | None | Service health check |
| GET | `/api/profile/seeker/` | JWT | Get seeker profile |
| POST | `/api/profile/seeker/` | JWT | Create seeker profile |
| PATCH | `/api/profile/seeker/` | JWT | Update seeker profile |
| GET | `/api/profile/seeker/skills/` | JWT | List seeker skills |
| POST | `/api/profile/seeker/skills/` | JWT | Add skill with years of experience |
| GET | `/api/profile/seeker/experiences/` | JWT | List work experiences |
| POST | `/api/profile/seeker/experiences/` | JWT | Add work experience |
| GET | `/api/profile/seeker/resumes/` | JWT | List resumes |
| POST | `/api/profile/seeker/resumes/` | JWT | Upload resume (PDF) |
| PATCH | `/api/profile/seeker/resumes/:id/` | JWT | Update resume (set primary) |
| GET | `/api/profile/seeker/resumes/:id/download/` | JWT | Download resume file |
| GET | `/api/profile/seeker/:id/` | JWT | Get seeker by UUID |
| GET | `/api/profile/recruiter/` | JWT | Get recruiter profile |
| POST | `/api/profile/recruiter/` | JWT | Create recruiter profile |
| PATCH | `/api/profile/recruiter/` | JWT | Update recruiter profile |
| GET | `/api/profile/recruiter/:id/` | JWT | Get recruiter by UUID |

### 7.3 Job Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/jobs/health/` | None | Service health check |
| GET | `/api/jobs/` | None | List active jobs (search, filter, paginate) |
| POST | `/api/jobs/create/` | JWT+Recruiter | Create job listing |
| GET | `/api/jobs/my/` | JWT+Recruiter | List recruiter's own jobs |
| GET | `/api/jobs/categories/` | None | List job categories (cached 1hr) |
| GET | `/api/jobs/:id/` | None | Get job detail |
| PATCH | `/api/jobs/:id/` | JWT+Recruiter | Update job listing |
| POST | `/api/jobs/:id/publish/` | JWT+Recruiter | Publish draft job |
| POST | `/api/jobs/:id/close/` | JWT+Recruiter | Close job |
| POST | `/api/jobs/:id/archive/` | JWT+Recruiter | Archive job |
| POST | `/api/jobs/:id/restore/` | JWT+Recruiter | Restore archived job |

### 7.4 Application Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/applications/health/` | None | Service health check |
| POST | `/api/applications/apply/` | JWT+Seeker | Submit job application |
| GET | `/api/applications/my/` | JWT+Seeker | List seeker's applications |
| GET | `/api/applications/job/:id/` | JWT+Recruiter | List applicants for a job |
| POST | `/api/applications/:id/stage/` | JWT+Recruiter | Update application stage |
| POST | `/api/applications/:id/schedule-interview/` | JWT+Recruiter | Schedule interview + Jitsi link |

### 7.5 Matching Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/match/health/` | None | Service health check |
| POST | `/api/match/embed/resume/` | Internal | Upsert resume embedding |
| POST | `/api/match/embed/job/` | Internal | Upsert job embedding |
| GET | `/api/match/jobs-for-seeker/:id/` | None | Top 10 matched jobs for seeker |
| GET | `/api/match/seekers-for-job/:id/` | None | Top 10 matched seekers for job |
| GET | `/api/match/ai-review/` | None | AI alignment review (query: seeker_id, job_id) |
| POST | `/api/match/chat/` | None | AI chatbot RAG query |

### 7.6 Notification Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/notifications/` | JWT | List user's notifications |
| GET | `/api/notifications/unread-count/` | JWT | Get unread notification count |
| POST | `/api/notifications/:id/mark-read/` | JWT | Mark single notification read |
| POST | `/api/notifications/mark-all-read/` | JWT | Mark all notifications read |

### 7.7 Chat Service

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/chat/health/` | None | Service health check |
| GET | `/api/chat/conversations/` | JWT | List user's conversations |
| POST | `/api/chat/conversations/` | JWT | Create new conversation |
| GET | `/api/chat/conversations/:id/messages/` | JWT | List messages in conversation |
| POST | `/api/chat/conversations/:id/messages/` | JWT | Send message in conversation |
| WS | `/api/chat/ws/` | JWT | WebSocket connection (ASGI) |

---

## 8. Database Design

### 8.1 Schema Architecture

- **Single PostgreSQL instance** (`jobportal_db`) with **7 isolated schemas**
- Each microservice owns exactly one schema (no cross-schema foreign keys)
- Services reference foreign UUIDs as plain columns (logical relationship only)
- **pgvector extension** installed on the database for 384-dim embedding support

### 8.2 Schema Map

```
jobportal_db/
├── auth_schema          (Auth Service)
│   ├── users
│   └── email_otps
├── profile_schema      (Profile Service)
│   ├── seeker_profiles
│   ├── recruiter_profiles
│   ├── skills
│   ├── seeker_skills
│   ├── experiences
│   └── resumes
├── job_schema           (Job Service)
│   ├── jobs
│   ├── job_categories
│   └── job_skills
├── app_schema           (Application Service)
│   ├── applications
│   └── interviews
├── match_schema         (Matching Service)
│   ├── job_embeddings
│   └── resume_embeddings
├── notification_schema  (Notification Service)
│   └── notifications
└── chat_schema          (Chat Service)
    ├── conversations
    └── messages
```

### 8.3 Key Design Decisions

- **UUID Primary Keys**: All tables use `UUIDField(primary_key=True, default=uuid.uuid4)` for distributed-friendly IDs
- **JSON Fields**: Screening questions, screening answers, notification payload use `JSONField` for flexible schema
- **Vector Field**: `VectorField(dimensions=384)` from `django-pgvector` for embedding storage
- **Composite Unique Constraints**: `(seeker, skill)` on seeker_skills prevents duplicate skill assignments
- **Normalized Skills**: `Skill` table with unique `name` constraint prevents duplicate entries
- **No Cross-Schema FKs**: True microservice isolation; services reference UUIDs as plain columns

See [docs/database_schema.md](./docs/database_schema.md) for complete schema details.

---

## 9. Frontend Architecture

### 9.1 Structure

```
frontend/src/app/
├── core/
│   ├── guards/                  # Route guards (auth, role)
│   ├── interceptors/            # HTTP interceptors (JWT injection)
│   ├── models/                  # TypeScript interfaces
│   └── services/                # Core services (ApiService, AuthStateService)
├── features/
│   ├── auth/                    # Login, register, OTP, password reset
│   ├── profile/                 # Seeker/recruiter profile management
│   ├── jobs/                    # Job listing, detail, create, manage
│   ├── applications/            # Application tracking
│   ├── matches/                 # AI match results
│   ├── chat/                    # Real-time messaging
│   ├── notifications/           # Notification center
│   ├── admin/                   # Admin dashboard
│   ├── about/                   # About page
│   └── landing/                 # Landing/home page
├── shared/
│   ├── components/              # Reusable components (AI drawer, chatbot sidebar)
│   ├── pipes/                   # Custom pipes (salary formatting)
│   └── utils/                   # Utility functions (error message extraction)
└── layout/                      # Navbar, theme toggle
```

### 9.2 State Management

- **Angular Signals** (`signal()`, `computed()`, `effect()`) for reactive state
- **localStorage** persistence for session state and theme preference
- **RxJS** for HTTP calls, polling (`interval(8000)` for chat unread), and parallel requests (`forkJoin`)
- **`AuthStateService`** with computed selectors for centralized session state

### 9.3 Key Components

| Component | Purpose |
|-----------|---------|
| `AiAlignmentDrawerComponent` | Reusable drawer showing AI match analysis (shared across 4 features) |
| `ChatbotSidebarComponent` | AI RAG chatbot with markdown rendering, suggestion chips, typing indicators |
| `SalaryPipe` | Pure pipe formatting salary ranges |
| `AlertService` | SweetAlert2 wrapper for confirmations and notifications |
| `ThemeService` | Dark mode with system preference detection + manual toggle |

### 9.4 Performance Optimizations

- Lazy-loaded routes via `loadComponent` (all 10 feature pages)
- `eventCoalescing: true` for change detection optimization
- Computed signals for memoized derived state
- Skeleton loading states during data fetch
- Scroll-to-bottom FAB for chat (shown only when scrolled up)
- Responsive CSS grid with `minmax()` and `auto-fill`

---

## 10. AI/ML Pipeline

### 10.1 Embedding Generation

```
Resume PDF Upload
    │
    ▼
PyMuPDF (fitz) text extraction
    │
    ▼
Sentence Transformers (all-MiniLM-L6-v2)
    │  Singleton model (loaded once, cached)
    │  384-dim normalized embeddings
    ▼
pgvector UPSERT (match_schema.resume_embeddings)
```

- **Model**: `sentence-transformers/all-MiniLM-L6-v2` — 384-dimensional embeddings
- **Loading**: Singleton pattern — model loaded once per process, cached in `_MODEL` variable
- **Normalization**: `normalize_embeddings=True` for cosine similarity compatibility
- **Fallback**: Deterministic SHA-256 based embedding when model fails to load
- **Storage**: `VectorField(dimensions=384)` in `match_schema`
- **Sync**: `sync_embeddings.py` script and management command to backfill missing embeddings

### 10.2 Vector Similarity Search

```sql
-- pgvector CosineDistance query (via Django ORM)
JobEmbedding.objects.annotate(
    distance=CosineDistance('embedding', seeker_vector)
).order_by('distance')[:10]
```

- Returns top 10 matches per query
- Uses `CosineDistance` for semantic similarity measurement
- IVFFlat index support for approximate nearest neighbor search at scale

### 10.3 AI Alignment Review

```
Seeker Resume + Job Posting
    │
    ▼
Cross-schema SQL query (profile_schema + job_schema)
    │
    ▼
AI Provider (configurable)
    ├── Google Gemini (default): genai.GenerativeModel
    ├── OpenAI-compatible: HTTP POST to /v1/chat/completions
    └── Fallback: Realistic domain-aware simulated review
    │
    ▼
Structured JSON response:
{
    "match_score": 85,
    "summary": "...",
    "strengths": ["...", "..."],
    "gaps": ["...", "..."],
    "interview_questions": ["...", "..."]
}
    │
    ▼
Redis Cache (24-hour TTL, invalidated on data change)
```

- Provider configured via `AI_PROVIDER` setting (`gemini`, `openai`, `openrouter`, `opencode`)
- Cache key includes resume update timestamp + job update timestamp for smart invalidation
- Cross-schema raw SQL queries controlled and read-only
- Realistic fallback adjusts tone based on job domain (Python, Angular, generic)

### 10.4 RAG Chatbot

```
User Query
    │
    ▼
Embedding generation (same Sentence Transformer model)
    │
    ▼
pgvector similarity search → top 3 jobs
    │
    ▼
Context injection (job titles, descriptions, skills)
    │
    ▼
LLM response generation (with last 6 messages of history)
    │
    ▼
Markdown-formatted answer
```

---

## 11. Event-Driven Architecture

### 11.1 Kafka Topics

| Event | Producer | Consumer(s) | Purpose |
|-------|----------|-------------|---------|
| `user.registered` | Auth Service | Notification Service | Send welcome email |
| `resume.uploaded` | Profile Service | Matching Service | Generate resume embedding |
| `job.published` | Job Service | Matching Service | Generate job embedding |
| `application.stage_changed` | Application Service | Notification Service | Notify seeker of stage change |
| `chat.message_sent` | Chat Service | Notification Service | Notify recipient of new message |
| `interview.scheduled` | Application Service | Notification Service | Notify seeker of interview |

### 11.2 Resilience Patterns

**3-Layer Fallback Chain**:
```
Kafka Broker ──► Celery Task (with retry) ──► Database
   Layer 1            Layer 2                    Layer 3
```

- **Kafka**: Primary event bus; singleton producer in each service
- **Celery Fallback**: If Kafka publish fails, task is queued in Celery with `max_retries=5, default_retry_delay=60`
- **Dead Letter Queue (DLQ)**: Failed Kafka messages routed to `*-dlq` topics with error context for debugging
- **Graceful Degradation**: All Kafka failures are logged but never crash the request; user experience is unaffected

### 11.3 Event Flow Example: Resume Upload

```
1. User uploads PDF via Profile Service
2. Profile Service: saves file → parses text → creates DB record
3. Profile Kafka Client: publishes `resume.uploaded` event
4. Matching Service Kafka Consumer: receives event
5. Matching Service: generates embedding → upserts to match_schema
6. (If Kafka fails) Celery task retries with backoff
7. (If Celery fails) Error logged, manual retry via sync_embeddings.py
```

---

## 12. Security

| Measure | Implementation | Effectiveness |
|---------|---------------|---------------|
| **JWT Authentication** | Access token (60 min) + refresh token (7 days) with role and user_id in payload | Stateless, scalable |
| **Custom JWT Decode** | Each service independently decodes and validates JWT using shared SECRET_KEY | Eliminates auth service bottleneck |
| **Password Hashing** | Django default PBKDF2 algorithm | Industry standard |
| **Role-Based Access Control** | `IsSeeker`, `IsRecruiter`, `IsAdmin` permission classes in 3 services | Enforces least privilege |
| **Rate Limiting** | Per-role throttle rates in `throttling.py`: anon 100/d, seeker 1000/d, recruiter 5000/d, admin 10000/d | Prevents abuse |
| **Login Brute-Force** | Redis-based IP+email rate limit: max 5 attempts per minute | Prevents credential stuffing |
| **Token Blacklisting** | SimpleJWT blacklist + Redis fallback for server-side logout | Enables session invalidation |
| **Email Verification** | 6-digit OTP required before account activation | Prevents fake registrations |
| **Input Validation** | DRF Serializers with field-level validation | Prevents malformed input |
| **CORS Configuration** | Nginx-level CORS headers + `django-cors-headers` | Controls cross-origin access |
| **SQL Injection Protection** | Django ORM (primary) + parameterized raw SQL (cross-schema queries) | Prevents injection attacks |
| **XSS Protection** | Angular's built-in sanitization (auto-escapes template values) | Prevents script injection |
| **Secret Management** | `.env` files via `python-decouple` | Secrets outside codebase |
| **File Upload Validation** | PDF-only accept in frontend, type validation | Reduces attack surface |
| **Resume Access Control** | `check_resume_access()` — only owner or associated recruiter can download | Data isolation |

---

## 13. Performance & Caching

### 13.1 Redis Cache Strategy

| Cache | TTL | Invalidation Trigger |
|-------|-----|---------------------|
| Job listings | 300s (5 min) | Publish, close, archive, restore |
| Job categories | 3600s (1 hr) | Category CRUD |
| AI alignment reviews | 86400s (24 hr) | Resume or job update (timestamp-based key) |
| Token blacklist | Variable | Until token expiry |
| OTP storage | 600s (10 min) | Automatic TTL expiry |
| Rate limit counters | 60s (1 min) | Automatic TTL expiry |

### 13.2 Cache Invalidation

- **Pattern-based deletion**: `RedisClient.delete_pattern('jobs:list:*')` clears all matching keys
- **Smart cache keys**: AI review cache key includes `resume_updated` and `job_updated` timestamps for automatic freshness
- **Graceful degradation**: All Redis operations wrapped in try-catch; service continues without cache if Redis is down

### 13.3 Database Optimizations

- `select_related` + `prefetch_related` for N+1 query prevention in job listings
- UUID primary keys for faster inserts in distributed context
- pgvector IVFFlat index support for approximate nearest neighbor search
- Connection pooling via Django DB settings

### 13.4 Frontend Optimizations

- Lazy-loaded routes reduce initial bundle size
- Computed signals prevent unnecessary re-renders
- Skeleton loading states improve perceived performance
- Pure pipes only recalculate on input change
- Scroll-to-bottom FAB only renders when user is scrolled up

---

## 14. Setup & Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 20+**
- **PostgreSQL 16+** with pgvector extension
- **Docker** (for Redis, Kafka, Zookeeper, Nginx)
- **Angular CLI** (`npm install -g @angular/cli`)

### Quick Start

See [docs/setup_guide.md](./docs/setup_guide.md) for complete step-by-step setup.

```bash
# 1. Clone the repository
git clone <repo-url>
cd job-buddy

# 2. Set up PostgreSQL database
psql -U postgres -c "CREATE DATABASE jobportal_db;"
psql -U postgres -d jobportal_db -f scripts/init_db.sql

# 3. Start infrastructure (Redis, Kafka, Zookeeper, Nginx)
docker-compose up -d

# 4. Set up and start each backend service
# (See setup_guide.md for detailed instructions)

# 5. Start frontend
cd frontend && npm install && ng serve

# 6. Access the application
# Frontend: http://localhost:4200
# Backend (via Nginx): http://localhost:80/api/auth/health/
```

---

## 15. Usage Guide

See [docs/e2e_runbook.md](./docs/e2e_runbook.md) for complete end-to-end walkthrough.

### Quick User Flows

**As a Job Seeker**:
1. Register → Verify email → Login
2. Complete profile (name, title, summary, skills, experience)
3. Upload resume (PDF)
4. Browse jobs or view AI-matched jobs
5. Apply with resume + screening answers
6. Track application stages
7. Chat with recruiters
8. Use AI chatbot for job market questions

**As a Recruiter**:
1. Register (recruiter role) → Verify email → Login
2. Complete company profile
3. Create jobs with screening questions
4. Publish jobs
5. View AI-matched candidates with alignment reports
6. Review applications and update stages
7. Schedule interviews (auto Jitsi link)
8. Chat with candidates

---

## 16. Testing

### Backend Tests

```bash
# Run tests for a specific service
cd backend/auth_service
python manage.py test

cd backend/profile_service
python manage.py test

cd backend/job_service
python manage.py test

cd backend/application_service
python manage.py test
```

### Frontend Tests

```bash
cd frontend
ng test
```

### Health Check

```bash
# Run the comprehensive health check script
bash health_check.sh

# Check database connectivity
python check_db_connection.py
```

---

## 17. Deployment

### Docker Deployment

The infrastructure services (Redis, Kafka, Zookeeper, Nginx) are containerized via `docker-compose.yml`. Backend services and frontend run natively during development.

### Production Considerations

1. **Separate databases** per service for true isolation
2. **Kubernetes** with HPA for auto-scaling each microservice
3. **Django Channels + WebSocket** for real-time chat (replacing polling)
4. **CDN** for resume file delivery
5. **Read replicas** for PostgreSQL to distribute query load
6. **Embedding generation in Celery task** to avoid blocking HTTP requests
7. **Separate SECRET_KEY** per service with auth validation via auth service
8. **SSL/TLS termination** at Nginx level

---

## 18. Project Structure

```
job-buddy/
├── README.md                         # This file
├── PROJECT_ANALYSIS_REPORT.md        # Engineering audit report
├── docker-compose.yml                # Infrastructure: Redis, Kafka, Zookeeper, Nginx
├── health_check.sh                   # Backend health check script
├── check_db_connection.py            # Database connectivity diagnostic
├── .gitignore                        # Git ignore rules
│
├── backend/
│   ├── auth_service/                 # Auth service (:8001)
│   │   ├── auth_service/             # Django project config
│   │   │   ├── settings.py           # DB, JWT, Celery, Kafka config
│   │   │   ├── urls.py               # Root URL routing
│   │   │   ├── celery.py             # Celery app configuration
│   │   │   ├── asgi.py               # ASGI config
│   │   │   └── wsgi.py               # WSGI config
│   │   └── accounts/                 # Django app
│   │       ├── models/               # User, EmailOTP models
│   │       ├── dao/                  # UserDAO, OTPDAO
│   │       ├── services/             # Auth, Email, Kafka, Redis services
│   │       ├── handlers/             # Auth flow orchestration
│   │       ├── api/                  # Views, serializers, URLs
│   │       ├── tasks.py              # Celery tasks
│   │       └── migrations/           # DB migrations
│   │
│   ├── profile_service/              # Profile service (:8002)
│   │   ├── profile_service/          # Django project config
│   │   └── profiles/                 # Django app
│   │       ├── models/               # Seeker, Recruiter, Skill, Experience, Resume
│   │       ├── dao/                  # ProfileDAO, ResumeDAO
│   │       ├── services/             # Profile, Resume, Kafka, Redis services
│   │       ├── handlers/             # Resume upload orchestration
│   │       ├── api/                  # Views, serializers, URLs
│   │       ├── tasks/                # Celery tasks
│   │       ├── utils.py              # File validation
│   │       ├── utils_local.py        # Local file storage
│   │       └── migrations/           # DB migrations
│   │
│   ├── job_service/                  # Job service (:8003)
│   │   ├── job_service/              # Django project config
│   │   ├── jobs/                     # Django app
│   │   │   ├── models/               # Job, JobCategory, JobSkill
│   │   │   ├── dao/                  # JobDAO
│   │   │   ├── services/             # Job, Kafka, Redis services
│   │   │   ├── api/                  # Views, serializers, URLs
│   │   │   ├── tasks/                # Celery, Kafka tasks
│   │   │   └── migrations/           # DB migrations
│   │   ├── create_dummy_jobs.py      # Dummy data seeding script
│   │   └── refactor.py               # Refactoring utility
│   │
│   ├── application_service/          # Application service (:8004)
│   │   ├── application_service/      # Django project config
│   │   └── applications/             # Django app
│   │       ├── models/               # Application, Interview
│   │       ├── dao/                  # ApplicationDAO
│   │       ├── services/             # Application, Kafka, Redis, JobServiceClient
│   │       ├── handlers/             # Application orchestration
│   │       ├── api/                  # Views, serializers, URLs
│   │       ├── tasks/                # Celery tasks, event definitions
│   │       └── migrations/           # DB migrations
│   │
│   ├── matching_service/             # Matching service (:8005)
│   │   ├── matching_service/         # Django project config
│   │   ├── matching/                 # Django app
│   │   │   ├── models/               # ResumeEmbedding, JobEmbedding (VectorField)
│   │   │   ├── dao/                  # ResumeDAO, JobDAO (pgvector queries)
│   │   │   ├── services/             # Matching, Embedding, AI (multi-provider), Kafka, Redis
│   │   │   ├── api/                  # Views (matching, embeddings, AI), serializers, URLs
│   │   │   ├── management/           # Kafka consumer management command
│   │   │   ├── utils.py              # Sentence Transformer singleton, vector helpers
│   │   │   └── migrations/           # DB migrations
│   │   ├── sync_embeddings.py        # Embedding sync script
│   │   └── check_matching_db.py      # Matching DB diagnostic
│   │
│   ├── notification_service/         # Notification service (:8006)
│   │   ├── notification_service/     # Django project config
│   │   └── notifications/            # Django app
│   │       ├── models/               # Notification model
│   │       ├── dao/                  # NotificationDAO
│   │       ├── services/             # Notification, Kafka (with DLQ), Redis
│   │       ├── api/                  # Views, serializers, URLs
│   │       ├── management/           # Kafka consumer management command
│   │       └── migrations/           # DB migrations
│   │
│   └── chat_service/                 # Chat service (:8007)
│       ├── chat_service/             # Django project config
│       │   ├── settings.py           # DB, CORS, Kafka config
│       │   ├── urls.py               # Root URL routing
│       │   ├── celery.py             # Celery app
│       │   ├── asgi.py               # ASGI + WebSocket routing
│       │   ├── middleware.py         # Custom request middleware
│       │   └── authentication.py     # JWT authentication
│       └── chat/                     # Django app
│           ├── models.py             # Conversation, Message models
│           ├── views.py              # REST endpoints
│           ├── serializers.py        # Message serialization
│           ├── consumers.py          # WebSocket consumer
│           ├── urls.py               # Chat URL routing
│           ├── services/             # Kafka, Redis services
│           ├── tasks/                # Celery tasks
│           └── migrations/           # DB migrations
│
├── frontend/                         # Angular 20 SPA
│   ├── src/app/
│   │   ├── core/                     # Guards, interceptors, models, services
│   │   ├── features/                 # 10 lazy-loaded feature modules
│   │   ├── shared/                   # Pipes, components, utils
│   │   └── layout/                   # Navbar, theme toggle
│   ├── package.json                  # Node dependencies
│   ├── angular.json                  # Angular CLI config
│   ├── tsconfig.json                 # TypeScript config
│   └── proxy.conf.json               # Dev proxy to Nginx
│
├── nginx/
│   └── nginx.conf                    # API Gateway configuration (7 upstreams)
│
├── scripts/
│   ├── init_db.sql                   # Database schema initialization
│   ├── start_backends.sh             # Start all 7 backend services
│   └── stop_backends.sh              # Stop all 7 backend services
│
├── docs/
│   ├── architecture.md               # Architecture documentation
│   ├── database_schema.md            # Database schema documentation
│   ├── setup_guide.md                # Setup and installation guide
│   └── e2e_runbook.md                # End-to-end usage runbook
│
├── dummy_resumes/                    # Sample PDF resumes for testing
│   ├── Resume_Backend_Engineer.pdf
│   ├── Resume_Cloud_Architect.pdf
│   ├── Resume_Data_Scientist.pdf
│   ├── Resume_DevOps_Engineer.pdf
│   └── Resume_Frontend_Developer.pdf
│
└── check_db_connection.py            # Standalone DB diagnostic script
```

---

## 19. Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -m 'Add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

### Development Guidelines

- Follow existing code style and patterns (see [PROJECT_ANALYSIS_REPORT.md](./PROJECT_ANALYSIS_REPORT.md) for conventions)
- Maintain consistent layered architecture (View → Handler → Service → DAO → Model)
- Add tests for new functionality
- Update documentation for API changes
- Ensure all migrations are reversible

---

## 20. License

MIT License — see LICENSE file for details.

---

## Additional Resources

- [Architecture Documentation](./docs/architecture.md) — Detailed system design and patterns
- [Database Schema](./docs/database_schema.md) — Complete table definitions and relationships
- [Setup Guide](./docs/setup_guide.md) — Step-by-step development environment setup
- [E2E Runbook](./docs/e2e_runbook.md) — End-to-end user walkthrough
- [Project Analysis Report](./PROJECT_ANALYSIS_REPORT.md) — Engineering audit and resume guide

---

*Built with Django REST Framework, Angular 20, PostgreSQL + pgvector, Apache Kafka, Redis, and Docker.*
