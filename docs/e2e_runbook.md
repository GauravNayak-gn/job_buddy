# End-to-End Runbook

> **Job Buddy** — Complete user flow walkthrough with API examples and frontend navigation.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Flow 1: Seeker Journey](#2-flow-1-seeker-journey)
3. [Flow 2: Recruiter Journey](#3-flow-2-recruiter-journey)
4. [Flow 3: AI Matching Pipeline](#4-flow-3-ai-matching-pipeline)
5. [Flow 4: Chat & Communication](#5-flow-4-chat--communication)
6. [Flow 5: Admin Operations](#6-flow-5-admin-operations)
7. [Flow 6: Event Processing (Kafka)](#7-flow-6-event-processing-kafka)
8. [Error Scenarios & Recovery](#8-error-scenarios--recovery)
9. [Testing with Dummy Data](#9-testing-with-dummy-data)
10. [Debugging Tips](#10-debugging-tips)

---

## 1. Overview

This runbook walks through every user flow in the Job Buddy platform, from registration to AI-powered matching. Each flow includes:
- **Frontend navigation path**
- **API endpoint calls with example requests/responses**
- **Backend processing details**
- **Kafka/Celery event flow**

---

## 2. Flow 1: Seeker Journey

**Actor**: Job Seeker  
**Goal**: Register, build profile, upload resume, discover jobs, apply, track applications

### Step 1: User Registration

**Frontend**: Landing page → "Get Started" → Register form

**API Call**:
```bash
curl -X POST http://localhost:80/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seeker@example.com",
    "password": "Secure@123",
    "role": "seeker"
  }'
```

**Response** (201 Created):
```json
{
  "message": "User registered successfully. Please check your email for OTP.",
  "email": "seeker@example.com"
}
```

**Backend Processing**:
1. `RegisterView` → validates input via `RegistrationSerializer`
2. `AuthHandler.register_user()`:
   - Creates `CustomUser` with `is_verified=False`
   - Generates 6-digit OTP (stored in Redis with 10-min TTL, fallback DB)
   - Calls `EmailService.send_otp_email()` via Gmail SMTP
   - Publishes `user.registered` event to Kafka
3. **Kafka Event**: `user.registered` → Notification Service → send welcome email

### Step 2: Email Verification (OTP)

**Frontend**: Redirected to OTP verification page → enter 6-digit code

**API Call**:
```bash
curl -X POST http://localhost:80/api/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seeker@example.com",
    "otp": "482916"
  }'
```

**Response** (200 OK):
```json
{
  "message": "Email verified successfully.",
  "access": "eyJ0eXAiOiJKV1Qi...",
  "refresh": "eyJ0eXAiOiJKV1Qi..."
}
```

**Backend Processing**:
1. `VerifyOTPView` → checks OTP in Redis (or DB fallback)
2. If valid and not expired: sets `user.is_verified=True`, marks OTP as used
3. Returns JWT access token (60 min) + refresh token (7 days)

### Step 3: Login

**Frontend**: Login page → email + password → submit

**API Call**:
```bash
curl -X POST http://localhost:80/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seeker@example.com",
    "password": "Secure@123"
  }'
```

**Response** (200 OK):
```json
{
  "access": "eyJ0eXAiOiJKV1Qi...",
  "refresh": "eyJ0eXAiOiJKV1Qi...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "seeker@example.com",
    "role": "seeker",
    "is_verified": true
  }
}
```

**Backend Processing**:
1. `LoginView` → checks Redis rate limit key `rate_limit:127.0.0.1:seeker@example.com`
2. If >5 attempts in 60s → 429 Too Many Requests
3. Validates credentials against DB
4. Generates JWT tokens via SimpleJWT
5. Returns tokens + user info

**Frontend Behavior**:
- Stores tokens in `localStorage`
- `AuthStateService` updates `currentUser` signal
- `AuthInterceptor` attaches `Authorization: Bearer <access>` to all subsequent requests
- Redirects to appropriate dashboard (seeker → jobs page, recruiter → my jobs)

### Step 4: Create Seeker Profile

**Frontend**: Profile page → Edit Profile → fill in details

**API Call** (authentication required):
```bash
curl -X POST http://localhost:80/api/profile/seeker/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "name": "John Doe",
    "contact": "+1-555-0123",
    "title": "Senior Python Developer",
    "summary": "Experienced backend developer with 5+ years in Python and Django.",
    "github_url": "https://github.com/johndoe",
    "linkedin_url": "https://linkedin.com/in/johndoe"
  }'
```

**Response** (201 Created):
```json
{
  "id": "660e8400-e29b-41d4-a716-446655440001",
  "name": "John Doe",
  "title": "Senior Python Developer",
  "summary": "Experienced backend developer with 5+ years in Python and Django.",
  "skills": [],
  "experiences": [],
  "resumes": []
}
```

### Step 5: Add Skills

**Frontend**: Profile page → Skills section → Add Skill

```bash
curl -X POST http://localhost:80/api/profile/seeker/skills/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "name": "Python",
    "years_of_experience": 5
  }'
```

**Response** (201 Created):
```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "name": "Python",
  "years_of_experience": 5
}
```

**Backend Logic**:
- Looks up or creates `Skill` by name (case-insensitive unique constraint)
- Creates `SeekerSkill` with years_of_experience
- Deduplication: composite unique key `(seeker_id, skill_id)` prevents duplicates

### Step 6: Add Work Experience

**Frontend**: Profile page → Experience section → Add Experience

```bash
curl -X POST http://localhost:80/api/profile/seeker/experiences/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "role": "Senior Backend Developer",
    "company": "Tech Corp",
    "start_date": "2022-01-15",
    "end_date": null,
    "description": "Leading backend development team, building REST APIs with Django."
  }'
```

**Response** (201 Created):
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440003",
  "role": "Senior Backend Developer",
  "company": "Tech Corp",
  "start_date": "2022-01-15",
  "end_date": null,
  "description": "Leading backend development team, building REST APIs with Django.",
  "is_current": true
}
```

### Step 7: Upload Resume (PDF)

**Frontend**: Profile page → Resumes section → Upload Resume

```bash
curl -X POST http://localhost:80/api/profile/seeker/resumes/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -F "file=@/path/to/resume.pdf" \
  -F "title=Software Engineer Resume"
```

**Response** (201 Created):
```json
{
  "id": "990e8400-e29b-41d4-a716-446655440004",
  "title": "Software Engineer Resume",
  "file_size": 245760,
  "parsing_status": "pending",
  "is_primary": true
}
```

**Backend Processing**:
1. `ResumeUploadView` → validates file type (PDF only) and size
2. `ResumeHandler.handle_resume_upload()`:
   - Saves file to local storage: `resumes/{user_id}/{uuid}.pdf`
   - Extracts text via PyMuPDF (`fitz.open()`)
   - Creates `Resume` record with `parsing_status='pending'`
   - Sets as primary if first resume
   - Publishes `resume.uploaded` event to Kafka
3. **Kafka Event** → Matching Service consumer:
   - Receives `resume.uploaded` event
   - Generates embedding via Sentence Transformers
   - Upserts into `match_schema.resume_embeddings`

### Step 8: Browse Jobs

**Frontend**: Jobs page → browse listing → filter by category/location

**API Call** (public, no auth required):
```bash
curl "http://localhost:80/api/jobs/?location_type=remote&category=Engineering"
```

**Response** (200 OK):
```json
{
  "count": 15,
  "results": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440005",
      "title": "Senior Python Developer",
      "slug": "senior-python-developer-a1b2c3d4",
      "company": "Tech Corp",
      "location_type": "remote",
      "salary_min": 120000,
      "salary_max": 160000,
      "category": "Engineering",
      "skills": ["Python", "Django", "PostgreSQL"],
      "published_at": "2026-06-01T10:00:00Z"
    }
  ]
}
```

**Backend Processing**:
1. `JobListView` → checks Redis cache key `jobs:list:filter_params`
2. If cached → return cached data (TTL: 300s)
3. If not cached → query DB with filters, cache result, return
4. Uses `select_related('category')` and `prefetch_related('skill_set')` for N+1 prevention

### Step 9: View AI-Matched Jobs

**Frontend**: Matches page → "Jobs recommended for you"

**API Call** (uses seeker ID from JWT):
```bash
curl http://localhost:80/api/match/jobs-for-seeker/660e8400-e29b-41d4-a716-446655440001/
```

**Response** (200 OK):
```json
{
  "seeker_id": "660e8400-e29b-41d4-a716-446655440001",
  "matches": [
    {
      "job_id": "aa0e8400-e29b-41d4-a716-446655440005",
      "title": "Senior Python Developer",
      "similarity_score": 0.92,
      "skills": ["Python", "Django", "PostgreSQL"]
    },
    {
      "job_id": "bb0e8400-e29b-41d4-a716-446655440006",
      "title": "Backend Engineer",
      "similarity_score": 0.87,
      "skills": ["Python", "FastAPI", "MongoDB"]
    }
  ]
}
```

**Backend Processing**:
1. `JobsForSeekerView` → checks Redis cache
2. Fetches seeker's resume embedding from `match_schema.resume_embeddings`
3. Performs pgvector `CosineDistance` query against `match_schema.job_embeddings`
4. Orders by distance ascending, returns top 10
5. Filters to only `published` jobs
6. Caches result for 300 seconds

### Step 10: Apply to Job

**Frontend**: Job detail page → "Apply Now" → Select resume → Answer screening questions

**API Call**:
```bash
curl -X POST http://localhost:80/api/applications/apply/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "job_id": "aa0e8400-e29b-41d4-a716-446655440005",
    "resume_id": "990e8400-e29b-41d4-a716-446655440004",
    "cover_letter": "I am excited to apply for this position...",
    "screening_answers": [
      {"question": "How many years of Python experience?", "answer": "5 years"},
      {"question": "Are you willing to relocate?", "answer": "Yes"}
    ]
  }'
```

**Response** (201 Created):
```json
{
  "id": "cc0e8400-e29b-41d4-a716-446655440007",
  "job_title": "Senior Python Developer",
  "stage": "applied",
  "created_at": "2026-06-09T12:00:00Z"
}
```

**Backend Processing**:
1. `ApplyView` → JWT required, seeker role only
2. `ApplicationHandler.apply_for_job()`:
   - Validates job exists (via `JobServiceClient.get_job()`)
   - Checks duplicate application (frontend already prevents this)
   - Creates `Application` record with `stage='applied'`
   - Processes screening answers JSON
   - Publishes `application.stage_changed` event to Kafka
3. **Kafka Event** → Notification Service → creates in-app notification for seeker

### Step 11: Track Application Stages

**Frontend**: My Applications page → view all applications with stage badges

```bash
curl http://localhost:80/api/applications/my/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..."
```

**Response** (200 OK):
```json
{
  "count": 3,
  "results": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440007",
      "job_title": "Senior Python Developer",
      "company": "Tech Corp",
      "stage": "interview_scheduled",
      "scheduled_at": "2026-06-15T14:00:00Z",
      "jitsi_link": "https://meet.jit.si/jobbuddy-abc123"
    }
  ]
}
```

### Step 12: View AI Alignment Review

**Frontend**: Matches or Applications page → "View AI Review" button → drawer opens

**API Call**:
```bash
curl "http://localhost:80/api/match/ai-review/?seeker_id=660e8400-e29b-41d4-a716-446655440001&job_id=aa0e8400-e29b-41d4-a716-446655440005"
```

**Response** (200 OK):
```json
{
  "match_score": 85,
  "summary": "John Doe is a strong match for the Senior Python Developer position...",
  "strengths": [
    "5+ years Python experience matches requirement",
    "Django expertise aligns with framework requirement",
    "Experience with PostgreSQL matches database requirement"
  ],
  "gaps": [
    "No experience with AWS mentioned in resume",
    "No team lead experience explicitly stated"
  ],
  "interview_questions": [
    "Can you describe a complex Django project you architected?",
    "How would you optimize a slow PostgreSQL query?",
    "Tell me about a time you mentored junior developers."
  ]
}
```

**Backend Processing**:
1. `AiReviewView` → checks Redis cache key `ai_alignment:seeker:job:resume_updated:job_updated`
2. If cached → return (TTL: 86400s = 24 hours)
3. If not cached:
   - Executes raw SQL across `profile_schema` and `job_schema` to get seeker + job data
   - Calls `AiService.generate_alignment_review(seeker_data, job_data)`
   - If Gemini configured: calls Google Gemini API with engineered prompt
   - If OpenAI configured: calls OpenAI-compatible API
   - If API fails: returns realistic domain-aware simulated review
   - Caches result with timestamp-based key for smart invalidation

---

## 3. Flow 2: Recruiter Journey

**Actor**: Recruiter  
**Goal**: Register, create company profile, post jobs, review candidates, schedule interviews

### Step 1: Register as Recruiter

```bash
curl -X POST http://localhost:80/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "recruiter@company.com",
    "password": "Secure@123",
    "role": "recruiter"
  }'
```

### Step 2: Create Recruiter Profile

```bash
curl -X POST http://localhost:80/api/profile/recruiter/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "company_name": "Tech Corp",
    "company_size": "51-200",
    "industry": "Technology",
    "headquarters": "San Francisco, CA",
    "website": "https://techcorp.com"
  }'
```

### Step 3: Create a Job Listing

**Frontend**: My Jobs → Create Job → fill form with details + screening questions

```bash
curl -X POST http://localhost:80/api/jobs/create/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "title": "Senior Python Developer",
    "description": "We are looking for a senior Python developer...",
    "location": "San Francisco, CA",
    "location_type": "remote",
    "salary_min": 120000,
    "salary_max": 160000,
    "experience_required": "5+ years",
    "category": "Engineering",
    "skills": ["Python", "Django", "PostgreSQL", "AWS"],
    "screening_questions": [
      {"question": "How many years of Python experience do you have?", "required": true, "type": "text"},
      {"question": "Are you willing to relocate?", "required": true, "type": "boolean"},
      {"question": "Do you have experience with AWS?", "required": false, "type": "text"}
    ]
  }'
```

**Response** (201 Created):
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "title": "Senior Python Developer",
  "slug": "senior-python-developer-a1b2c3d4",
  "status": "draft",
  "created_at": "2026-06-09T12:00:00Z"
}
```

### Step 4: Publish Job

**Frontend**: My Jobs → click "Publish" on draft job

```bash
curl -X POST http://localhost:80/api/jobs/aa0e8400-e29b-41d4-a716-446655440005/publish/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..."
```

**Response** (200 OK):
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440005",
  "status": "published",
  "published_at": "2026-06-09T12:00:00Z"
}
```

**Backend Processing**:
1. `PublishJobView` → checks recruiter owns this job
2. `JobService.publish_job()`:
   - Validates current status is `draft`
   - Updates status to `published`, sets `published_at`
   - Clears cache: `jobs:list:*` pattern
   - Publishes `job.published` event to Kafka
3. **Kafka Event** → Matching Service → generates job embedding → pgvector upsert

### Step 5: View AI-Matched Candidates

**Frontend**: Job detail page → "Candidates" tab → view ranked matches

```bash
curl http://localhost:80/api/match/seekers-for-job/aa0e8400-e29b-41d4-a716-446655440005/
```

**Response** (200 OK):
```json
{
  "job_id": "aa0e8400-e29b-41d4-a716-446655440005",
  "matches": [
    {
      "seeker_id": "660e8400-e29b-41d4-a716-446655440001",
      "name": "John Doe",
      "title": "Senior Python Developer",
      "similarity_score": 0.92
    }
  ]
}
```

### Step 6: Review Applications

**Frontend**: Job detail → "Applications" tab → list of applicants

```bash
curl http://localhost:80/api/applications/job/aa0e8400-e29b-41d4-a716-446655440005/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..."
```

**Response** (200 OK):
```json
{
  "count": 5,
  "results": [
    {
      "id": "cc0e8400-e29b-41d4-a716-446655440007",
      "seeker_name": "John Doe",
      "seeker_title": "Senior Python Developer",
      "stage": "applied",
      "applied_at": "2026-06-09T12:00:00Z",
      "resume_url": "/api/profile/seeker/resumes/990e8400/download/"
    }
  ]
}
```

### Step 7: Update Application Stage

**Frontend**: Click "Shortlist" or "Schedule Interview"

```bash
curl -X POST http://localhost:80/api/applications/cc0e8400-e29b-41d4-a716-446655440007/stage/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "stage": "shortlisted"
  }'
```

### Step 8: Schedule Interview

**Frontend**: Click "Schedule Interview" → pick date/time → confirm

```bash
curl -X POST http://localhost:80/api/applications/cc0e8400-e29b-41d4-a716-446655440007/schedule-interview/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "scheduled_at": "2026-06-15T14:00:00Z",
    "notes": "Technical interview - Python and system design"
  }'
```

**Response** (200 OK):
```json
{
  "application_id": "cc0e8400-e29b-41d4-a716-446655440007",
  "interview": {
    "id": "dd0e8400-e29b-41d4-a716-446655440008",
    "scheduled_at": "2026-06-15T14:00:00Z",
    "jitsi_link": "https://meet.jit.si/jobbuddy-abc123def456",
    "notes": "Technical interview - Python and system design"
  }
}
```

**Backend Processing**:
1. `ScheduleInterviewView` → recruiter only
2. `ApplicationHandler.schedule_interview()`:
   - Validates application is in `shortlisted` or `applied` stage
   - Creates `Interview` record with auto-generated Jitsi link
   - Updates application stage to `interview_scheduled`
   - Publishes `interview.scheduled` event to Kafka
3. **Kafka Event** → Notification Service:
   - Creates in-app notification for seeker
   - Sends email to seeker with interview details and Jitsi link

---

## 4. Flow 3: AI Matching Pipeline

**Trigger**: Resume upload or job publish  
**Components**: Profile/Job Service → Kafka → Matching Service → pgvector

### Step 1: Resume Upload Triggers Embedding

```
User uploads PDF
  → Profile Service saves file, parses text, creates Resume record
  → KafkaProducerClient.send('resume.uploaded', payload)
  → Matching Service consumer receives event
  → embedding_service.generate_embedding(resume_text)
  → SentenceTransformer.encode(text, normalize_embeddings=True)
  → 384-dim float vector
  → ResumeEmbeddingDAO.upsert(seeker_id, embedding)
  → pgvector: INSERT INTO resume_embeddings ... ON CONFLICT (seeker_id) DO UPDATE
```

### Step 2: Matching Query

```
User requests matches
  → MatchingService.get_matched_jobs_for_seeker(seeker_id)
  → Redis cache check (key: matches:seeker:{seeker_id})
  → If miss:
    → Fetch seeker's resume embedding
    → pgvector query:
        SELECT je.job_id, CosineDistance(je.embedding, %s) as distance
        FROM match_schema.job_embeddings je
        JOIN job_schema.jobs j ON j.id = je.job_id
        WHERE j.status = 'published'
        ORDER BY distance
        LIMIT 10
    → Cache result for 300s
    → Return top 10 matches with similarity scores
```

### Step 3: AI Alignment Review

```
User requests AI review
  → Cross-schema raw SQL to get seeker profile + job data
  → Check Redis cache (key includes timestamps for freshness)
  → If miss:
    → Construct prompt with seeker data and job data
    → Call AI provider:
      if AI_PROVIDER == 'gemini':
          genai.GenerativeModel('gemini-2.0-flash').generate_content(prompt)
      elif AI_PROVIDER == 'openai':
          requests.post(OPENAI_API_BASE + '/chat/completions', json=payload, headers=headers)
      else:
          return realistic_simulated_review(seeker_data, job_data)
    → Parse structured JSON response
    → Cache for 24 hours
    → Return match score, strengths, gaps, interview questions
```

---

## 5. Flow 4: Chat & Communication

**Actor**: Seeker and Recruiter  
**Goal**: Communicate per job posting

### Step 1: Create Conversation

**Frontend**: Application detail → "Message Recruiter" button

```bash
curl -X POST http://localhost:80/api/chat/conversations/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "participant_b": "recruiter-uuid",
    "job_id": "aa0e8400-e29b-41d4-a716-446655440005",
    "job_title": "Senior Python Developer"
  }'
```

### Step 2: Send Message

```bash
curl -X POST http://localhost:80/api/chat/conversations/conversation-uuid/messages/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -d '{
    "body": "Hello! I am very interested in this position."
  }'
```

**Backend Processing**:
1. Creates `Message` record with conversation_id, sender_id, body
2. Publishes `chat.message_sent` event to Kafka
3. **Kafka Event** → Notification Service:
   - Creates in-app notification for recipient
   - Sends email notification (optional)

### Step 3: Receive Messages via WebSocket (Frontend)

The frontend opens a persistent WebSocket connection when the user logs in. Incoming messages are delivered in real time through RxJS Subjects.

```typescript
// Chat service manages WebSocket lifecycle
private connectWebSocket(): void {
  const wsUrl = `${protocol}//${host}/api/chat/ws/?token=${token}`;
  this.ws = new WebSocket(wsUrl);

  this.ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'message') {
      this.messageReceived$.next({
        message: data.message,
        conversation_id: data.conversation_id
      });
    }
  };

  this.ws.onclose = () => {
    // Auto-reconnect after 3 seconds
    setTimeout(() => this.connectWebSocket(), 3000);
  };
}
```

### Step 4: Unread Detection (WebSocket-Driven)

```typescript
// Unread status is checked when a WebSocket message arrives
// Chat service onmessage handler:
this.ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'message' || data.type === 'conversation') {
    this.checkUnreadStatus();  // Fires a REST call to refresh unread count
  }
};
```

---

## 6. Flow 5: Admin Operations

**Actor**: Platform Admin  
**Goal**: Monitor platform health, manage users and jobs

### Admin Endpoints

```bash
# View all users (admin only)
# Via Django admin: http://localhost:8001/admin/

# Check health of all services
bash health_check.sh

# View database status
python check_db_connection.py
```

### Admin Frontend

- Accessible via Admin dashboard (only visible to users with `role=admin`)
- User management: view, disable, delete users
- Job management: view all jobs, force close/archive
- System monitoring: service health status

---

## 7. Flow 6: Event Processing (Kafka)

### Visualizing Event Flow

```
┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Auth Service   │────▶│ user.registered │────▶│ Notification     │
│ (registration) │     │                 │     │ Service (email)  │
└───────────────┘     └─────────────────┘     └──────────────────┘

┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Profile Service│────▶│ resume.uploaded │────▶│ Matching Service │
│ (resume upload)│     │                 │     │ (embedding gen)  │
└───────────────┘     └─────────────────┘     └──────────────────┘

┌───────────────┐     ┌─────────────────┐     ┌──────────────────┐
│ Job Service    │────▶│ job.published    │────▶│ Matching Service │
│ (publish job)  │     │                  │     │ (embedding gen)  │
└───────────────┘     └─────────────────┘     └──────────────────┘

┌───────────────┐     ┌────────────────────┐  ┌──────────────────┐
│ Application   │────▶│ app.stage_changed  │──▶│ Notification     │
│ Service       │     │ interview.scheduled│  │ Service (notif)  │
└───────────────┘     └────────────────────┘  └──────────────────┘

┌───────────────┐     ┌──────────────────┐     ┌──────────────────┐
│ Chat Service   │────▶│ chat.message_sent│────▶│ Notification     │
│ (send message) │     │                  │     │ Service (notif)  │
└───────────────┘     └──────────────────┘     └──────────────────┘
```

### Monitoring Kafka Events

```bash
# Watch resume.uploaded events in real-time
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic resume.uploaded --from-beginning

# Watch all events
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic user.registered --from-beginning

# Check DLQ (dead letter queue) for failed events
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic matching-dlq --from-beginning
```

### Testing Kafka Resilience

```bash
# 1. Stop Kafka container
docker-compose stop kafka

# 2. Perform a resume upload (should trigger Celery fallback)
curl -X POST ... (upload resume)

# 3. Check Celery logs for retry
# The task should retry with backoff

# 4. Restart Kafka
docker-compose start kafka

# 5. Check if pending Celery tasks successfully published to Kafka
```

---

## 8. Error Scenarios & Recovery

### 8.1 Scenario: Kafka Down During Resume Upload

**What happens**:
1. User uploads resume → Profile Service saves file locally
2. Kafka publish fails → `KafkaProducerClient.send()` returns error
3. Celery fallback task: `process_resume_async` created with `max_retries=5, default_retry_delay=60`
4. Task retries every 60 seconds with exponential backoff
5. **User sees**: Success (file saved); embedding generation is async — no user-facing error

**Recovery**:
```bash
# Check Celery task status
celery -A profile_service inspect registered

# Manually trigger embedding sync if needed
cd backend/matching_service && python sync_embeddings.py
```

### 8.2 Scenario: Redis Down

**What happens**:
- All `RedisClient` methods return `None` or empty dict
- Cache is bypassed; requests go directly to database
- Rate limiting disabled (temporarily less secure)
- Token blacklist fallback to DB
- Celery broker unavailable (tasks queued in memory — lost on restart)

**Recovery**:
```bash
# Restart Redis
docker-compose restart redis

# Once Redis is back, cache repopulates on next request
```

### 8.3 Scenario: PostgreSQL Down

**What happens**:
- All services return 500 errors on any data operation
- Read-only operations may work if data is in cache
- Logged in: `ConnectionError: could not connect to server`

**Recovery**:
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Restart PostgreSQL
sudo systemctl restart postgresql

# Check logs
sudo journalctl -u postgresql -n 50
```

### 8.4 Scenario: Email Service Failure (OTP)

**What happens**:
- OTP generation succeeds (stored in Redis + DB)
- Gmail SMTP send fails
- In debug mode: OTP is returned in API response for testing
- In production: error is logged, user can request resend

**Recovery**:
```bash
# Check email configuration in .env
# Ensure Gmail app password is correct
# Check Gmail account for security alerts
```

### 8.5 Scenario: AI Provider Unavailable

**What happens**:
- Gemini/OpenAI API call fails
- `AiService.generate_alignment_review()` falls back to realistic simulated review
- Simulated review analyzes job domain (Python, Angular, generic) and returns reasonable content
- **User sees**: Normal-looking AI review (seamless degradation)

**Recovery**:
```bash
# Check API key validity
curl -X POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY \
  -H "Content-Type: application/json" \
  -d '{"contents": [{"parts": [{"text": "Hello"}]}]}'

# Switch provider in .env
AI_PROVIDER=openai  # or openrouter
```

### 8.6 Scenario: Duplicate Application Attempt

**Frontend prevents**: `appliedJobIds` computed signal tracks applied jobs
**Backend failsafe**: `ApplicationHandler` checks for existing application

**If bypassed**: Returns 400 Bad Request with:
```json
{
  "error": "You have already applied to this job"
}
```

---

## 9. Testing with Dummy Data

### 9.1 Seed Dummy Jobs

```bash
cd backend/job_service
source venv/bin/activate
python create_dummy_jobs.py
```

This creates sample jobs across categories (Engineering, Design, Marketing, etc.) with various locations, salary ranges, and skills.

### 9.2 Upload Dummy Resumes

The `dummy_resumes/` directory contains pre-made PDF resumes:

| File | Role |
|------|------|
| `Resume_Backend_Engineer.pdf` | Backend Engineer |
| `Resume_Cloud_Architect.pdf` | Cloud Architect |
| `Resume_Data_Scientist.pdf` | Data Scientist |
| `Resume_DevOps_Engineer.pdf` | DevOps Engineer |
| `Resume_Frontend_Developer.pdf` | Frontend Developer |

Upload via frontend or API:
```bash
curl -X POST http://localhost:80/api/profile/seeker/resumes/ \
  -H "Authorization: Bearer eyJ0eXAiOiJKV1Qi..." \
  -F "file=@dummy_resumes/Resume_Backend_Engineer.pdf" \
  -F "title=Backend Engineer Resume"
```

### 9.3 Sync Embeddings

After seeding dummy data, sync any missing embeddings:

```bash
cd backend/matching_service
source venv/bin/activate
python sync_embeddings.py
```

Or via management command:
```bash
python manage.py sync_embeddings
```

### 9.4 Test Complete Flow with Dummy Data

```bash
# 1. Register as seeker
curl -X POST ... (register seeker)

# 2. Verify OTP (check server logs for debug OTP)
curl -X POST ... (verify OTP)

# 3. Create profile
curl -X POST ... (create seeker profile)

# 4. Upload dummy resume
curl -X POST ... (upload dummy resume)

# 5. Check for AI-matched jobs
curl http://localhost:80/api/match/jobs-for-seeker/{seeker_id}/

# 6. Apply to a job
curl -X POST ... (apply to job)

# 7. Register as recruiter
curl -X POST ... (register recruiter)

# 8. Create recruiter profile
curl -X POST ... (create recruiter profile)

# 9. View applicants
curl http://localhost:80/api/applications/job/{job_id}/
```

---

## 10. Debugging Tips

### 10.1 Check Service Logs

```bash
# Each service writes to /tmp/jobbuddy_{service}.log
tail -f /tmp/jobbuddy_auth_service.log
tail -f /tmp/jobbuddy_matching_service.log

# Django development server logs
# Look for:
# - [ERROR] messages
# - Traceback (most recent call last)
# - 500 Internal Server Error
```

### 10.2 Check Nginx Logs

```bash
# Nginx logs (if running in Docker)
docker exec jobportal_nginx cat /var/log/nginx/access.log
docker exec jobportal_nginx cat /var/log/nginx/error.log

# Common Nginx issues:
# - 502 Bad Gateway → backend service not running
# - 499 Client Closed Request → browser timeout
# - 413 Request Entity Too Large → resume file too big
```

### 10.3 Check Celery Status

```bash
# List registered tasks
celery -A auth_service inspect registered

# Check active tasks
celery -A auth_service inspect active

# Check reserved tasks
celery -A auth_service inspect reserved

# View task results (if using result backend)
celery -A auth_service result <task_id>
```

### 10.4 Debug Kafka Messages

```bash
# Consume all events from beginning
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic resume.uploaded --from-beginning

# Check consumer group lag
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group matching-group --describe

# Expected output:
# TOPIC           PARTITION  CURRENT-OFFSET  LOG-END-OFFSET  LAG
# resume.uploaded 0          42              42              0
# (LAG=0 means all messages processed)
```

### 10.5 Debug Redis

```bash
# Monitor all Redis commands in real-time
redis-cli MONITOR

# Watch specific cache keys
redis-cli --scan --pattern 'jobs:*'

# Check cache hit ratio (approximate)
redis-cli INFO stats | grep keyspace_
```

### 10.6 Debug Database Queries

```bash
# Enable query logging in PostgreSQL
sudo -u postgres psql -c "ALTER SYSTEM SET log_min_duration_statement = 0;"
sudo systemctl restart postgresql

# View slow queries
sudo journalctl -u postgresql | grep "duration:"
```

### 10.7 Debug Django ORM Queries

```python
# In Django shell or view:
from django.db import connection

# Execute a query
list(Job.objects.filter(status='published'))

# Show queries
print(connection.queries)
```

### 10.8 Debug Frontend

```typescript
// In browser console:
// Check auth state
console.log(localStorage.getItem('accessToken'));
console.log(localStorage.getItem('refreshToken'));

// Check API calls (Network tab in DevTools)
// Look for:
// - 401 Unauthorized → token expired, need refresh
// - 403 Forbidden → wrong role
// - 429 Too Many Requests → rate limited
// - 500 Internal Server Error → backend issue
```

### 10.9 Common HTTP Status Codes

| Code | Meaning | Common Cause |
|------|---------|-------------|
| 200 | OK | Success |
| 201 | Created | Resource created |
| 204 | No Content | Deletion success |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/expired JWT |
| 403 | Forbidden | Wrong role for action |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Backend exception |

---

*This end-to-end runbook is part of the Job Buddy project. See [README.md](../README.md) for the full project overview.*
