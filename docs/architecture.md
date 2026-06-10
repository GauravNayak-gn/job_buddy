# Architecture Documentation

> **Job Buddy** — System Architecture, Design Patterns, Data Flow, and Engineering Decisions

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Microservices Breakdown](#3-microservices-breakdown)
4. [Layered Architecture Pattern](#4-layered-architecture-pattern)
5. [Request Flow](#5-request-flow)
6. [Event Flow](#6-event-flow)
7. [Design Patterns Used](#7-design-patterns-used)
8. [Engineering Decisions](#8-engineering-decisions)
9. [Scalability Analysis](#9-scalability-analysis)
10. [Security Architecture](#10-security-architecture)
11. [Async Processing](#11-async-processing)
12. [Cross-Service Communication](#12-cross-service-communication)

---

## 1. System Overview

Job Buddy is a **microservices-based job portal platform** consisting of:

- **7 Django REST Framework backend services** — each independently deployable, each owning its own database schema
- **1 Angular 20 SPA frontend** — standalone components, Signals state management, lazy-loaded routing
- **1 Nginx API Gateway** — reverse proxy routing `/api/{service}/` to backend upstreams
- **1 PostgreSQL 16 database** — single instance with 7 isolated schemas, pgvector extension for vector search
- **1 Redis 7 instance** — caching, Celery broker, token blacklist, OTP storage, rate limiting
- **1 Apache Kafka 7.6 cluster** — event bus with Zookeeper coordination, 6 event topics + DLQ topics

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Angular 20 SPA)                      │
│           http://localhost:4200 (dev) or port 80 (prod)              │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTP /api/*
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Nginx API Gateway (port 80)                     │
│                                                                      │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  Routing Table:                                                 │  │
│  │  /api/auth/*            → auth_service:8001                    │  │
│  │  /api/profile/*         → profile_service:8002                 │  │
│  │  /api/jobs/*            → job_service:8003                     │  │
│  │  /api/applications/*    → application_service:8004             │  │
│  │  /api/match/*           → matching_service:8005                │  │
│  │  /api/notifications/*   → notification_service:8006            │  │
│  │  /api/chat/*            → chat_service:8007                    │  │
│  │  /api/chat/ws/*         → chat_service:8007 (WebSocket)        │  │
│  └───────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Features: CORS preflight handling, proxy headers, timeouts          │
└──┬──────┬──────┬──────┬──────┬──────┬──────┬────────────────────────┘
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
┌─────────────────────────────────────────────────────────────────────┐
│                   PostgreSQL 16 + pgvector                           │
│                   Database: jobportal_db                             │
│                                                                      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐      │
│  │auth_schema │ │profile_sch │ │ job_schema │ │ app_schema │      │
│  │  users     │ │ seeker_prof│ │ jobs       │ │applications│      │
│  │  email_otps│ │ recruiter_p│ │ categories │ │ interviews │      │
│  │            │ │ skills     │ │ job_skills │ │            │      │
│  │            │ │ experiences│ │            │ │            │      │
│  │            │ │ resumes    │ │            │ │            │      │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘      │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐                      │
│  │match_schema│ │notific_sch │ │ chat_schema│                      │
│  │job_embeddin│ │notificatio │ │conversation│                      │
│  │resume_embed│ │            │ │ messages   │                      │
│  └────────────┘ └────────────┘ └────────────┘                      │
└─────────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    │                       │
                    ▼                       ▼
           ┌─────────────────┐    ┌─────────────────┐
           │  Redis 7         │    │  Apache Kafka    │
           │  • Cache (TTL)   │    │  7.6 + ZK        │
           │  • Celery broker │    │                   │
           │  • Token blacklist│   │  Topics:          │
           │  • OTP storage   │    │  user.registered  │
           │  • Rate limiting │    │  resume.uploaded  │
           └─────────────────┘    │  job.published    │
                                  │  app.stage_changed│
                                  │  chat.message_sent│
                                  │  interview.sched. │
                                  │  *-dlq (DLQ)      │
                                  └─────────────────┘
```

---

## 2. High-Level Architecture

### 2.1 Architecture Style: Microservices

The application follows a **microservices architecture** where each business domain is encapsulated in its own service:

| Service | Domain | Port | Schema | Key Responsibility |
|---------|--------|------|--------|-------------------|
| Auth | Identity & Access | 8001 | `auth_schema` | Registration, JWT, OTP, login |
| Profile | User Profiles | 8002 | `profile_schema` | Seeker/recruiter profiles, resumes |
| Job | Job Listings | 8003 | `job_schema` | Job CRUD, search, publish workflow |
| Application | Applications | 8004 | `app_schema` | Apply, stages, interviews |
| Matching | AI Matching | 8005 | `match_schema` | Embeddings, vector search, AI reviews |
| Notification | Notifications | 8006 | `notification_schema` | In-app notifications, email dispatch |
| Chat | Messaging | 8007 | `chat_schema` | Conversations, messages |

### 2.2 Communication Patterns

| Pattern | Technology | Direction | Use Case |
|---------|-----------|-----------|----------|
| **Synchronous REST** | HTTP via Nginx | Client → Service | All CRUD operations |
| **Synchronous REST (internal)** | HTTP direct | Service → Service | Application Service fetches job details |
| **Asynchronous Events** | Apache Kafka | Service → Kafka → Service | Resume upload → embedding, job publish → embedding, stage change → notification |
| **Async Fallback** | Celery | Service → Celery → DB | Guaranteed delivery when Kafka is down |
| **WebSocket** | Django Channels ASGI | Frontend ↔ Backend | Real-time chat messaging |
| **WebSocket** | Django Channels ASGI | Frontend ↔ Backend | Future real-time chat upgrade |

### 2.3 Service Independence

Each microservice is **fully independent**:
- Own database schema (no cross-schema foreign keys)
- Own Django project with independent `settings.py`, `urls.py`, `manage.py`
- Own virtual environment (separate `venv/`)
- Own JWT validation (shared SECRET_KEY, each service decodes independently)
- Own Redis client (graceful degradation when Redis is down)
- Own Kafka producer client (singleton pattern)

---

## 3. Microservices Breakdown

### 3.1 Auth Service (`:8001`)

**Purpose**: Identity management, authentication, and authorization.

**Internal Structure**:
```
accounts/
├── models/
│   ├── __init__.py          # Exports User, EmailOTP
│   ├── user.py              # CustomUser: email (unique), password, role, is_verified
│   └── otp.py               # EmailOTP: email, otp (6-digit), purpose, expiry, is_used
├── dao/
│   ├── __init__.py          # Exports UserDAO, OTPDAO
│   ├── user_dao.py          # get_user_by_email, create_user
│   └── otp_dao.py           # create_otp, verify_otp, invalidate_otp
├── services/
│   ├── auth_service.py      # register_user, verify_otp, login_user, logout_user,
│   │                        # forgot_password, reset_password (83 lines)
│   ├── email_service.py     # send_otp_email via Gmail SMTP
│   ├── kafka_client.py      # Singleton Kafka producer, publishes user.registered
│   └── redis_client.py      # Redis wrapper: OTP, token blacklist, rate limiting
├── handlers/
│   └── auth_handler.py      # Orchestrates registration: create → send OTP → publish
├── api/
│   ├── urls.py              # 8 URL patterns
│   ├── views/
│   │   └── auth.py          # 8 API view classes (131 lines)
│   └── serializers/
│       └── auth.py          # Registration serializer with password validation
├── tasks.py                 # Celery tasks: send_otp_email, notify_user_registered
├── admin.py                 # User admin registration
├── apps.py                  # Django app config
└── tests.py                 # Test stubs
```

**Key Logic**:
- **Registration Flow**: Validate input → Create user (is_verified=False) → Generate 6-digit OTP (10min TTL) → Store in Redis (fallback DB) → Send via Gmail SMTP → Publish `user.registered` to Kafka
- **Login Rate Limiting**: Redis key `rate_limit:{ip}:{email}` → increment → if >5 in 60s → return 429
- **Token Blacklisting**: SimpleJWT blacklist API + Redis fallback `blacklisted_tokens:{token_id}`
- **Password Reset**: Validate email → Generate OTP → Verify OTP → Hash new password → Update user

### 3.2 Profile Service (`:8002`)

**Purpose**: User profile management (seeker & recruiter), skills, experience, resume upload/parsing.

**Internal Structure**:
```
profiles/
├── models/__init__.py       # SeekerProfile, RecruiterProfile, Skill, SeekerSkill, Experience, Resume
├── dao/
│   ├── profile.py           # get_seeker_by_user_id, get_seeker_by_id, update_seeker, etc.
│   └── resume.py            # create_resume, get_resumes, set_primary_resume, check_access
├── services/
│   ├── profile.py           # get_or_create_seeker, update_seeker_profile, skill management
│   ├── resume.py            # handle_upload (validate, save, parse), download with access check
│   ├── kafka_client.py      # Singleton producer, publishes resume.uploaded
│   └── redis_client.py      # Cache wrapper
├── handlers/
│   └── resume.py            # Orchestrates: validate file → save locally → parse PDF → create DB record → Kafka event
├── api/
│   ├── urls.py              # 10 URL patterns
│   ├── views/
│   │   ├── profile.py       # Seeker and recruiter profile views (187 lines)
│   │   └── resume.py        # Resume upload, list, download, set primary (90 lines)
│   └── serializers/
│       ├── profile.py       # Profile serializers
│       └── resume.py        # Resume serializers
├── tasks/
│   └── celery_tasks.py      # Async resume processing tasks
├── utils.py                 # File extension validation
├── utils_local.py           # Local file storage: save, read, delete with path construction
└── migrations/              # 2 migration files
```

**Key Logic**:
- **Resume Upload Pipeline**: Validate PDF → Save to local storage (path: `resumes/{user_id}/{uuid}.pdf`) → Extract text via PyMuPDF (`fitz`) → Create Resume record → Publish `resume.uploaded` event → Matching Service generates embedding
- **Resume Access Control**: `check_resume_access(user, resume)` — allows owner or recruiter who has a conversation with the seeker
- **Primary Resume Management**: `set_primary_resume(user_id, resume_id)` — atomically sets all other resumes non-primary, then sets the target as primary
- **Flexible Profile Lookup**: `get_seeker_profile_by_id_or_user_id()` handles both lookup patterns for cross-service compatibility

### 3.3 Job Service (`:8003`)

**Purpose**: Job listing CRUD, categorization, search/filter, status workflow.

**Internal Structure**:
```
jobs/
├── models/job.py            # Job (title, slug, description, location, salary range, experience, 
│                            #  screening_questions JSON, status field), JobCategory, JobSkill
├── dao/job_dao.py           # get_jobs (active/filtered), get_job_by_id, create_job, update_job,
│                            # select_related + prefetch_related optimization
├── services/
│   ├── job_service.py       # create_job, update_job, publish_job, close_job, archive_job,
│   │                        # restore_job — all with status validation + cache invalidation
│   ├── kafka_client.py      # Singleton producer, publishes job.published
│   └── redis_client.py      # Cache job listings (300s), categories (3600s)
├── api/
│   ├── urls.py              # 10 URL patterns
│   ├── views/
│   │   └── job_views.py     # Job CRUD + status endpoints (154 lines)
│   └── serializers/
│       └── job_serializers.py # Job serializer with nested skills and category
├── tasks/
│   ├── celery_tasks.py      # Email notifications for job status changes
│   └── kafka_tasks.py       # Kafka consumer tasks
└── migrations/              # 3 migration files
```

**Key Logic**:
- **Status Workflow**: `draft` → `published` → `closed` | `archived` → `restored` (back to published)
- **Slug Generation**: `slugify(title) + UUID4[:8]` for SEO-friendly unique URLs
- **Job Categories Caching**: Categories cached in Redis for 1 hour, invalidated on category changes
- **Screening Questions**: Stored as JSONField on the Job model; questions asked during application
- **Job Search**: Filter by `location_type` (remote/onsite/hybrid), `category`, text search on `title` and `description`

### 3.4 Application Service (`:8004`)

**Purpose**: Job applications, stage management, interview scheduling with Jitsi Meet.

**Internal Structure**:
```
applications/
├── models/application.py    # Application (job, seeker, resume, stage, cover_letter, 
│                            #  screening_answers JSON), Interview (scheduled_at, jitsi_link, notes)
├── dao/application_dao.py   # apply, get_applications_for_job, get_applications_for_seeker,
│                            # update_stage, schedule_interview, is_applied
├── services/
│   ├── application_service.py # Business logic for stage transitions
│   ├── kafka_client.py      # Singleton producer, publishes app.stage_changed, interview.scheduled
│   ├── redis_client.py      # Cache wrapper
│   └── job_service_client.py # HTTP client to fetch job details from Job Service
├── handlers/
│   └── application_handler.py # Orchestrates: validate → create application → process screening → events (113 lines)
├── api/
│   ├── urls.py              # 6 URL patterns
│   ├── views/
│   │   └── application_views.py # Application CRUD + stage + interview views (183 lines)
│   └── serializers/
│       └── application_serializers.py # Application and interview serializers
├── tasks/
│   ├── __init__.py
│   ├── celery_tasks.py      # Async email notifications for stage changes
│   └── events.py            # Event type definitions for Kafka
└── migrations/              # 3 migration files
```

**Key Logic**:
- **Application Stages**: `applied` → `shortlisted` → `interview_scheduled` → `selected` | `rejected`
- **Duplicate Prevention**: Frontend tracks `appliedJobIds` via computed signal
- **Jitsi Meet Integration**: Auto-generates Jitsi video conference link when scheduling interview
- **Internal HTTP Call**: Fetches job details from Job Service via `job_service_client.py` to validate job exists and get employer info
- **On-Delete Cascade**: Interview records cascade-delete with Application

### 3.5 Matching Service (`:8005`)

**Purpose**: AI-powered semantic matching, vector similarity search, LLM-powered alignment reviews, RAG chatbot.

**Internal Structure** (most complex service):
```
matching/
├── models/
│   ├── resume_embedding.py  # ResumeEmbedding: seeker_id (UUID, indexed), embedding (VectorField(384)), model_version
│   └── job_embedding.py     # JobEmbedding: job_id (UUID, indexed), embedding (VectorField(384)), model_version
├── dao/
│   ├── resume_dao.py        # upsert_resume_embedding, get_resume_embedding, find_jobs_for_seeker
│   └── job_dao.py           # upsert_job_embedding, get_job_embedding, find_seekers_for_job
├── services/
│   ├── embedding_service.py # generate_embedding(text) → 384-dim vector via Sentence Transformers
│   ├── matching_service.py  # get_matched_jobs_for_seeker, get_matched_seekers_for_job, cache logic
│   ├── ai_service.py        # Multi-provider AI: Gemini, OpenAI/OpenRouter, fallback (295 lines)
│   ├── kafka_client.py      # Kafka consumer with DLQ support
│   └── redis_client.py      # Cache matches (300s), AI reviews (86400s)
├── api/
│   ├── urls.py              # 8 URL patterns
│   └── views/
│       ├── embeddings.py    # Resume/job embedding upsert endpoints
│       ├── matching.py      # Match query endpoints
│       ├── ai_views.py      # AI alignment review + chatbot endpoints (193 lines, cross-schema raw SQL)
│       └── health.py        # Health check endpoint
├── management/commands/
│   └── consume_events.py    # Kafka consumer: listens for resume.uploaded, job.published → generate embeddings
├── utils.py                 # Sentence Transformer singleton, vector list↔literal conversion, deterministic fallback
└── migrations/              # 2 migration files (pgvector migration)
```

**Key Logic**:
- **Embedding Generation**: Singleton Sentence Transformer model (`all-MiniLM-L6-v2`), `model.encode(text, normalize_embeddings=True)` → 384-dim float vector
- **Vector Search**: `JobEmbedding.objects.annotate(distance=CosineDistance('embedding', vec)).order_by('distance')[:10]`
- **AI Alignment Review**: Cross-schema SQL query → prompt engineer → Gemini/OpenAI API → structured JSON → cache 24h
- **RAG Chatbot**: Query → embedding → find top 3 jobs → inject context → LLM response with history (last 6 messages)
- **Deterministic Fallback**: SHA-256 hash of text → seeded random → creates consistent pseudo-embedding
- **Dead Letter Queue**: Failed Kafka messages routed to `*-dlq` topics with error payload

### 3.6 Notification Service (`:8006`)

**Purpose**: In-app notification management, email dispatch via Kafka event consumption.

**Internal Structure**:
```
notifications/
├── models/notification.py   # Notification: user_id, type, title, body, payload (JSON), is_read, read_at
├── dao/notification_dao.py  # create_notification, get_notifications (paginated, filtered), 
│                            # get_unread_count, mark_read, mark_all_read
├── services/
│   ├── notification_service.py # Business logic: create, list, mark read
│   ├── kafka_client.py      # Kafka consumer with DLQ; processes all 6 event types, sends emails
│   └── redis_client.py      # Cache unread counts
├── api/
│   ├── urls.py              # 4 URL patterns
│   ├── views/
│   │   └── notification.py  # List, unread count, mark read, mark all read (50 lines)
│   └── serializers/
│       └── notification.py  # Notification serializer
├── management/commands/
│   └── consume_events.py    # Kafka consumer: routes events by type → creates notification + sends email (129 lines)
└── migrations/              # 1 migration file
```

**Key Logic**:
- **Event Processing**: Consumes all 6 event types from Kafka; each event type maps to a specific notification template
- **Email Dispatch**: For events like `application.stage_changed` and `interview.scheduled`, sends email via Gmail SMTP
- **DLQ Support**: Failed messages are routed to `notification-dlq` topic with error context for debugging
- **Unread Count Caching**: Redis key `notifications:unread:{user_id}` with TTL for fast access

### 3.7 Chat Service (`:8007`)

**Purpose**: User-to-user messaging between recruiters and seekers, organized per job posting.

**Internal Structure**:
```
chat/
├── models.py                # Conversation (participant_a, participant_b, job_id, job_title),
│                            # Message (conversation FK, sender_id, body, created_at)
├── views.py                 # Conversation list/create, message list/send (145 lines)
├── serializers.py           # Message serializer with user details
├── consumers.py             # WebSocket consumer (Django Channels AsyncWebsocketConsumer)
├── urls.py                  # Chat URL routing
├── services/
│   ├── kafka_client.py      # Singleton producer, publishes chat.message_sent
│   └── redis_client.py      # Cache conversation data
└── tasks/
    └── celery_tasks.py      # Async notification tasks

chat_service/
├── asgi.py                  # ASGI config with WebSocket routing
├── middleware.py             # Custom request middleware
└── authentication.py        # JWT authentication for chat
```

**Key Logic**:
- **Conversation Creation**: Unique per (participant_a, participant_b, job_id) combination
- **Message Ordering**: Ordered by `created_at` ascending
- **Unread Detection**: Triggered via WebSocket events + REST check on login
- **WebSocket Real-Time Messaging**: Django Channels `AsyncWebsocketConsumer` with JWT auth, auto-reconnect on frontend
- **Kafka Events**: `chat.message_sent` published for each message (consumed by Notification Service)

---

## 4. Layered Architecture Pattern

Every microservice follows a consistent **layered architecture**:

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: API (views/, urls/, serializers/)                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  • Receives HTTP requests                               ││
│  │  • Validates input via serializers                      ││
│  │  • Returns HTTP responses                               ││
│  │  • Applies authentication, permissions, throttling      ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 2: Handler (handlers/)                           ││
│  │  • Orchestrates multi-step operations                   ││
│  │  • Coordinates multiple services/DAOs                   ││
│  │  • Manages transactions and event publishing            ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 3: Service (services/)                           ││
│  │  • Pure business logic                                  ││
│  │  • No direct database access                            ││
│  │  • Calls DAO layer for data operations                  ││
│  │  • No HTTP request/response awareness                   ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 4: DAO (dao/)                                    ││
│  │  • Data access objects                                  ││
│  │  • Database queries (ORM or raw SQL)                    ││
│  │  • No business logic                                    ││
│  │  • Returns model instances                              ││
│  └─────────────────────────────────────────────────────────┘│
│                              │                               │
│                              ▼                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Layer 5: Model (models/)                               ││
│  │  • Database table definitions (Django ORM)              ││
│  │  • Field validation, constraints                        ││
│  │  • No business logic                                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Example Flow** (Resume Upload):
```
HTTP POST /api/profile/seeker/resumes/
  → ProfileViewset.upload_resume()                    [Layer 1: View]
    → ResumeHandler.handle_resume_upload()             [Layer 2: Handler]
      → ResumeService.upload()                        [Layer 3: Service]
        → ResumeDAO.create_resume()                   [Layer 4: DAO]
          → Resume model.save()                       [Layer 5: Model]
      → ResumeService.extract_text_from_pdf()
        → PyMuPDF fitz.open()
      → ResumeService.save_to_storage()
        → local file system write
      → KafkaClient.publish('resume.uploaded')        [Cross-cutting]
```

---

## 5. Request Flow

### 5.1 Standard HTTP Request

```
1. Browser → Angular SPA (localhost:4200)
2. Angular HttpClient → JWT Interceptor (injects Authorization header)
3. Angular proxy.conf.json → Nginx (localhost:80)
4. Nginx → matches location block (/api/auth/*, /api/jobs/*, etc.)
5. Nginx → adds CORS headers, proxy_set_header
6. Nginx → proxy_pass to upstream service (localhost:8001-8007)
7. Django service → Authentication (JWT decode if required)
8. Django service → Permission check (role-based if required)
9. Django service → Throttle check (rate limit if required)
10. Django service → View → Handler → Service → DAO → Model
11. Response flows back: Model → DAO → Service → Handler → View → DRF Response
12. Nginx → adds CORS headers to response
13. Angular → ApiService processes response → Component updates signal
```

### 5.2 CORS Handling (Nginx Level)

Nginx handles all CORS preflight (`OPTIONS`) requests at the gateway level, returning `204 No Content` with appropriate headers:

```
Request: OPTIONS /api/jobs/
Response: 204
  Access-Control-Allow-Origin: *
  Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS
  Access-Control-Allow-Headers: Authorization, Content-Type, Accept, Origin, X-Requested-With
  Access-Control-Max-Age: 86400
```

This prevents browsers from receiving `502 Bad Gateway` errors when preflight requests hit Django services directly.

---

## 6. Event Flow

### 6.1 Kafka Topics and Event Types

| Topic | Producer | Consumer(s) | Payload | Purpose |
|-------|----------|-------------|---------|---------|
| `user.registered` | Auth Service | Notification Service | `{user_id, email, role, created_at}` | Send welcome email |
| `resume.uploaded` | Profile Service | Matching Service | `{resume_id, seeker_id, text, parsed_at}` | Generate resume embedding |
| `job.published` | Job Service | Matching Service | `{job_id, title, description, skills, published_at}` | Generate job embedding |
| `application.stage_changed` | Application Service | Notification Service | `{application_id, job_id, seeker_id, old_stage, new_stage}` | Notify seeker |
| `chat.message_sent` | Chat Service | Notification Service | `{message_id, conversation_id, sender_id, receiver_id}` | Notify recipient |
| `interview.scheduled` | Application Service | Notification Service | `{application_id, interview_id, seeker_id, scheduled_at, jitsi_link}` | Notify seeker |

### 6.2 Event Payload Schema

All events follow a consistent schema:
```json
{
    "event_type": "resume.uploaded",
    "event_id": "uuid4",
    "timestamp": "2026-06-09T12:00:00Z",
    "producer": "profile_service",
    "data": {
        "resume_id": "uuid",
        "seeker_id": "uuid",
        "text": "extracted text content...",
        "parsed_at": "2026-06-09T12:00:00Z"
    }
}
```

### 6.3 Resilience: 3-Layer Fallback Chain

```
Layer 1: Kafka (Primary)
  → Singleton KafkaProducerClient.send_event(topic, event)
  → future.get(timeout=5)
  → If success: done
  
Layer 2: Celery (Fallback)
  → If Kafka fails: fallback_to_celery(event_type, payload)
  → Celery task with:
    → max_retries=5
    → default_retry_delay=60 (exponential backoff)
    → Re-tries Kafka publish
  → If success: done

Layer 3: Database (Last Resort)
  → If Celery also fails:
    → Error logged with full context
    → Event stored in DB for manual retry
    → Notification: admin alerted of Kafka outage
```

### 6.4 Dead Letter Queue (DLQ)

Services with DLQ support:
- **Matching Service**: Failed embedding events → `matching-dlq` topic
- **Notification Service**: Failed notification events → `notification-dlq` topic

DLQ messages include:
```json
{
    "original_event": { ... },
    "error": "Exception message",
    "failed_at": "2026-06-09T12:00:00Z",
    "retry_count": 5
}
```

### 6.5 Complete Event Flow Example: Resume Upload → Matching

```
Step 1: User uploads PDF resume
  → Profile Service saves file and creates Resume record

Step 2: Profile Service publishes event
  → KafkaProducerClient.send('resume.uploaded', payload)
  → If Kafka down → CeleryTask with retry

Step 3: Matching Service Kafka Consumer receives event
  → consume_events command (long-running process)
  → Deserializes event payload

Step 4: Matching Service generates embedding
  → embedding_service.generate_embedding(resume_text)
  → Sentence Transformers produces 384-dim vector

Step 5: Matching Service stores embedding
  → ResumeEmbeddingDAO.upsert(seeker_id, embedding)
  → pgvector INSERT ON CONFLICT UPDATE

Step 6: Now ready for matching queries
  → find_jobs_for_seeker(seeker_id) returns top 10 matches
```

---

## 7. Design Patterns Used

### 7.1 Creational Patterns

| Pattern | Implementation | Location |
|---------|---------------|----------|
| **Singleton** | Kafka producer client with `_producer` class attribute | All `kafka_client.py` files |
| **Singleton** | Sentence Transformer model with `_MODEL` module variable | `matching/utils.py` |

### 7.2 Structural Patterns

| Pattern | Implementation | Location |
|---------|---------------|----------|
| **Facade** | `ApiService` wraps Angular `HttpClient` for all API calls | `frontend/src/app/core/services/api.service.ts` |
| **Repository** | DAO classes abstract data access behind interface | All `dao/*.py` files |

### 7.3 Behavioral Patterns

| Pattern | Implementation | Location |
|---------|---------------|----------|
| **Strategy** | `AiService` supports Gemini + OpenAI/OpenRouter providers | `matching/services/ai_service.py` |
| **Observer** | RxJS Observables for HTTP, Signals for state | Angular components |
| **Chain of Responsibility** | Django middleware pipeline | `settings.py` MIDDLEWARE |

### 7.4 Architectural Patterns

| Pattern | Implementation |
|---------|---------------|
| **Microservices** | 7 independent Django services |
| **API Gateway** | Nginx reverse proxy with URL-based routing |
| **Event-Driven** | Apache Kafka for async service communication |
| **Service Layer** | `services/*.py` with pure business logic |
| **Repository/DAO** | `dao/*.py` for data access abstraction |
| **Fallback Chain** | Kafka → Celery → DB |

---

## 8. Engineering Decisions

### 8.1 Why 7 Microservices Instead of a Monolith?

Each service maps to a bounded business domain (auth, profiles, jobs, applications, matching, notifications, chat). This allows:
- **Independent scaling**: Auth handles high-frequency requests; Matching is CPU-heavy for embeddings
- **Independent deployment**: Update one service without redeploying others
- **Technology flexibility**: Each service could use different tech stack in future

### 8.2 Why Schema-per-Service Instead of Separate Databases?

- **Single backup/restore**: One `pg_dump` backs up everything
- **Simpler operations**: One PostgreSQL instance to manage, monitor, tune
- **Easy migration path**: Schema-per-service can be split to separate databases without code changes
- **Cross-schema queries possible**: AI alignment reviews query profile + job schemas directly

### 8.3 Why Kafka + Celery Fallback?

- **Kafka**: Durable event log, replayability, consumer group scaling, ordered events within partitions
- **Celery**: Guaranteed delivery with retry, TTL-based expiry, integration with Django
- **Both together**: Kafka for real-time streaming; Celery for resiliency during Kafka outages

### 8.4 Why Custom JWT Auth in Each Service?

- **No auth service bottleneck**: Each service validates JWT independently using shared SECRET_KEY
- **Lower latency**: No cross-service HTTP call for auth on every request
- **Stateless**: Any instance of any service can validate any token
- **Fail-safe**: Auth service outage doesn't break other services' ability to validate tokens

### 8.5 Why pgvector Instead of a Separate Vector Database?

- **Zero network latency**: Similarity search happens in the same database transaction
- **Simplified operations**: No Pinecone/Weaviate/Pinecone to manage, backup, or monitor
- **ACID compliance**: Embedding updates are transactional with application data
- **Cost-effective**: No additional infrastructure cost

### 8.6 Why Angular Signals Instead of NgRx?

- **Framework-native**: Integrated with Angular's change detection
- **Less boilerplate**: No actions, reducers, effects, selectors for simple state
- **Fine-grained reactivity**: Signals track dependencies automatically
- **Simpler mental model**: `signal()`, `computed()`, `effect()` are intuitive

### 8.7 Why Asynchronous Kafka Events Instead of Synchronous HTTP?

- **Loose coupling**: Producer doesn't need consumer to be available
- **Resilience**: Kafka buffers events during consumer downtime
- **Replayability**: Kafka retains events for reprocessing
- **Scalability**: Multiple consumer instances can process events in parallel

---

## 9. Scalability Analysis

### 9.1 What Enables Scale

| Factor | Implementation |
|--------|---------------|
| **Stateless Services** | No session state; any instance handles any request |
| **Stateless JWT Auth** | No session store needed; token carries all user info |
| **Kafka Event Bus** | Services decoupled; producers don't wait for consumers |
| **Redis Caching** | Reduces database load for read-heavy endpoints |
| **Connection Pooling** | Django manages DB connection reuse |
| **Async Processing** | Celery offloads email, embedding, notifications |
| **Schema Isolation** | Services can migrate to separate databases without code changes |

### 9.2 Current Bottlenecks

| Bottleneck | Impact | Mitigation |
|-----------|--------|------------|
| Single PostgreSQL instance | All 7 schemas share one DB; write contention at scale | Schema-per-service allows easy migration to separate DBs |
| Real-time chat | WebSocket with auto-reconnect | Already implemented with Django Channels |
| Synchronous embedding | Sentence Transformers blocks request thread | Offload to Celery worker (architecture supports) |
| No horizontal scaling | No K8s/load balancer for auto-scaling | All services are stateless and can be replicated behind Nginx |
| Synchronous Kafka produce | `future.get(timeout=5)` blocks request | Non-blocking produce + callback pattern |

### 9.3 Future Improvements

1. **Scaling WebSocket connections** with multiple server instances using Redis channel layer
2. **Separate PostgreSQL databases** per service for true isolation
3. **Embedding generation in Celery task** to avoid blocking HTTP
4. **Kubernetes deployment** with HPA per microservice
5. **CDN for resume file delivery**
6. **PostgreSQL read replicas** for query distribution
7. **Kafka partitioning** per event type for parallel consumption

---

## 10. Security Architecture

### 10.1 Authentication Flow

```
Login Request
  → Validate credentials
  → Check rate limit (Redis: max 5 attempts/minute/IP+email)
  → Generate access token (60 min) + refresh token (7 days)
  → Tokens contain: user_id, role, token_type, exp, jti

Subsequent Requests
  → Frontend includes Authorization: Bearer <access_token>
  → Nginx passes through to backend
  → Each service decodes JWT independently:
    1. Extract token from Authorization header
    2. Decode with SECRET_KEY + RS256/HS256
    3. Validate signature, expiry, issuer
    4. Extract user_id and role from payload
    5. Create mock User object with role info
    6. Pass to DRF permission classes

Logout
  → SimpleJWT blacklist API blacklists the refresh token
  → Redis fallback: stores token jti with TTL until token expiry
  → Subsequent refresh attempts with blacklisted token fail
```

### 10.2 Authorization (RBAC)

Three roles: `seeker`, `recruiter`, `admin`

Permission classes (in `*/permissions.py`):
```python
class IsSeeker(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'seeker'

class IsRecruiter(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'recruiter'

class IsAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.role == 'admin'
```

### 10.3 Throttling (Rate Limiting)

Four throttle tiers (in `*/throttling.py`):
```python
class AnonRateThrottle(AnonRateThrottle):    rate = '100/day'
class SeekerRateThrottle(UserRateThrottle):   rate = '1000/day'
class RecruiterRateThrottle(UserRateThrottle): rate = '5000/day'
class AdminRateThrottle(UserRateThrottle):    rate = '10000/day'
```

Custom scope selection based on request user role.

### 10.4 Security Checklist

| Area | Implemented |
|------|------------|
| Password hashing | PBKDF2 (Django default) |
| JWT token expiry | 60 min access, 7 day refresh |
| Token blacklisting | SimpleJWT + Redis |
| Brute-force protection | Redis rate limit (5/min) |
| Email verification | 6-digit OTP |
| Input validation | DRF Serializers |
| SQL injection protection | Django ORM + parameterized SQL |
| XSS protection | Angular auto-escaping |
| CORS | Nginx-level headers |
| File upload validation | PDF-only |
| Resume access control | Owner + recruiter check |
| Secret management | .env files (python-decouple) |

---

## 11. Async Processing

### 11.1 Celery Configuration

Each service with Celery has:

```python
# celery.py
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'service.settings')
app = Celery('service')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
```

Settings (shared across services):
```python
CELERY_BROKER_URL = 'redis://localhost:6379/0'
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'
```

### 11.2 Celery Tasks

| Task | Service | Purpose | Retry Policy |
|------|---------|---------|-------------|
| `send_otp_email` | Auth | Send OTP via Gmail SMTP | max_retries=3, delay=60 |
| `notify_user_registered` | Auth | Fallback notification | max_retries=5, delay=60 |
| `process_resume_async` | Profile | Async resume parsing | max_retries=3, delay=30 |
| `notify_job_status_change` | Job | Email on job status change | max_retries=3, delay=60 |
| `notify_stage_change` | Application | Email on stage change | max_retries=3, delay=60 |
| `notify_interview` | Application | Email on interview scheduled | max_retries=3, delay=60 |
| `send_chat_notification` | Chat | Notify on new message | max_retries=3, delay=30 |

### 11.3 Management Commands

| Command | Service | Purpose |
|---------|---------|---------|
| `consume_events` | Matching | Long-running Kafka consumer for embedding events |
| `consume_events` | Notification | Long-running Kafka consumer for notification events |

These are run as separate processes:

```bash
cd backend/matching_service && python manage.py consume_events &
cd backend/notification_service && python manage.py consume_events &
```

---

## 12. Cross-Service Communication

### 12.1 Types of Communication

| Type | Mechanism | Example |
|------|-----------|---------|
| **Synchronous (REST)** | HTTP via requests library | Application Service fetches job details from Job Service |
| **Asynchronous (Events)** | Kafka | Profile Service publishes resume.uploaded → Matching Service consumes |
| **Shared Database (Read)** | Direct SQL (cross-schema) | Matching Service queries profile_schema + job_schema for AI review |
| **Shared Cache (Redis)** | Redis keys | Token blacklist shared across services |

### 12.2 Internal REST Client

Application Service's `job_service_client.py`:
```python
class JobServiceClient:
    BASE_URL = 'http://localhost:8003/api/jobs'
    
    @staticmethod
    def get_job(job_id):
        response = requests.get(f'{BASE_URL}/{job_id}/')
        return response.json() if response.ok else None
```

### 12.3 Cross-Schema Raw SQL (Matching Service)

For AI alignment reviews, the Matching Service queries across schemas:
```python
# In ai_views.py — raw SQL across profile_schema and job_schema
cursor.execute("""
    SELECT sp.name, sp.title, sp.summary,
           array_agg(DISTINCT s.name) as skills,
           json_agg(json_build_object('role', e.role, 'company', e.company)) as experiences
    FROM profile_schema.seeker_profiles sp
    LEFT JOIN profile_schema.seeker_skills ss ON ss.seeker_id = sp.id
    LEFT JOIN profile_schema.skills s ON s.id = ss.skill_id
    LEFT JOIN profile_schema.experiences e ON e.seeker_id = sp.id
    WHERE sp.user_id = %s
    GROUP BY sp.id
""", [seeker_id])
```

This is **controlled and read-only**:
- Only executed for authenticated requests
- Only reads data (no INSERT/UPDATE/DELETE)
- Uses parameterized queries (no SQL injection)
- Schema names are hardcoded (no user input in schema resolution)

---

## Appendix: Key Files Reference

| File | Lines | Purpose |
|------|-------|---------|
| `nginx/nginx.conf` | 108 | API Gateway configuration |
| `docker-compose.yml` | 50 | Infrastructure containerization |
| `health_check.sh` | 118 | Service health check script |
| `check_db_connection.py` | 188 | DB connectivity diagnostic |
| `scripts/init_db.sql` | 20 | Database schema initialization |
| `scripts/start_backends.sh` | 53 | Start all 7 backend services |
| `scripts/stop_backends.sh` | 33 | Stop all 7 backend services |
| `matching/services/ai_service.py` | 295 | Multi-provider AI (most complex file) |
| `matching/api/views/ai_views.py` | 193 | AI alignment review + chatbot |
| `notification/management/commands/consume_events.py` | 129 | Event consumer (most complex consumer) |
| `auth/accounts/api/views/auth.py` | 131 | Auth endpoints |
| `application/handlers/application_handler.py` | 113 | Application orchestration |

---

*This architecture document is part of the Job Buddy project. See [README.md](README.md) for the full project overview.*
