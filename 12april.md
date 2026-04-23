# Job Buddy API Testing Guide + Redis/Kafka Usage (12 April)

## 🎯 NEW: Service Capabilities & Test Status (Without S3/Matching)

| Service | Port | What it does | ✅ Testable Now? |
|---------|------|--------------|-----------------|
| Auth | 8001 | Login/Register | ✅ RIGHT |
| Profile | 8002 | Profiles/Skills/**Resume(S3)** | ❌ WRONG (skip resume) |
| Jobs | 8003 | Create/List jobs | ✅ RIGHT |
| Applications | 8004 | Apply/Interviews | ✅ RIGHT |
| Matching | 8005 | **AI Matching** | ❌ WRONG |
| Notifications | 8006 | Bell notifications | ✅ RIGHT (w/ sample data) |
| Chat | 8007 | Messages | ✅ RIGHT |

**Quick Test Path**: Auth → Profile(no resume) → Jobs → Applications → Notifications

## 🔥 Nginx Proxy (Recommended)
```
# All APIs accessible via http://localhost:80/api/{service}/
# Proxies to: auth(8001), profile(8002), jobs(8003), app(8004), match(8005), notif(8006), chat(8007)

# Examples:
curl http://localhost:80/api/auth/health/
→ {"status": "ok", "service": "auth"}

curl -H "Authorization: Bearer TOKEN" http://localhost:80/api/profile/seeker/
→ Seeker profile data
```

## Redis Usage (All Services settings.py CACHES)
```
CACHES = {
  'default': {
    'BACKEND': 'django_redis.cache.RedisCache',
    'LOCATION': 'redis://jobportal_redis:6379/0',
  }
}
docker compose.yml → jobportal_redis:6379 (exposed localhost:6379)

**Uses**:
1. Django sessions (login state)
2. JWT blacklist (logout invalidates tokens): cache.set('blacklist_{token}',1, 7days)
3. Rate limiting (Nginx + Redis)
4. Job listings cache (5min TTL)

**Test**: `redis-cli -p 6379 keys *` (see sessions/blacklist)
```

## Kafka Usage (kafka-python in requirements.txt)
```
settings.py: KAFKA_BOOTSTRAP_SERVERS='localhost:9092' (host) or 'kafka:29092' (Docker)
docker-compose.yml: kafka:9092 (ZK coord)

**Topics** (setup guide):
docker exec jobportal_kafka kafka-topics --create --topic user.registered --bootstrap-server localhost:9092
resume.uploaded, job.published, application.stage_changed, interview.scheduled

**Producers** (views.py utils.py):
def publish_user_registered(user):
  producer.send('user.registered', {'user_id': str(user.id), 'email': user.email, 'role': user.role})

**Consumers** (management/commands in matching/notification):
class Command(BaseCommand):
  def handle(self, *args, **options):
    consumer = KafkaConsumer('resume.uploaded', bootstrap_servers=['kafka:29092'])
    for msg in consumer:
      # process embedding/email
```

## **API Testing with curl** 

**Base URLs**: 
- Direct service: `http://localhost:8XXX/api/{endpoint}`
- Via Nginx proxy: `http://localhost/api/{service}/{endpoint}`

**Token Placeholders** (replace with actual values):
- `<SEEKER_TOKEN>` - JWT from seeker login
- `<RECRUITER_TOKEN>` - JWT from recruiter login  
- `<ACCESS_TOKEN>` - Generic access token
- `<JOB_UUID>` - UUID of job
- `<APP_UUID>` - UUID of application
- `<RESUME_UUID>` - UUID of resume
- `<NOTIF_UUID>` - UUID of notification

## Database Schema Per Service (from docs/database_schema.md)

### auth_schema (Auth Service)
**users table**:
| id | email | role | is_verified |
|----|-------|------|-------------|
| ed307432-e7d7-4f99-b2c2-14df fee73ff9 | seeker demo1@yopmail.com | seeker | true |

**email_otps table**:
| id | user_id | otp_code | purpose | expires_at |
|----|---------|----------|---------|------------|
| uuid | ed307... | 123456 | verify_email | 2026-04-12 12:00 |

### profile_schema (Profile Service)
**seeker_profiles**:
| id | user_id | first_name | current_title |
|----|---------|------------|---------------|
| b1.. | ed307.. | John | Django Dev |

**skills**:
| id | name |
|----|------|
| s1 | Python |

**seeker_skills**:
| id | seeker_id | skill_id | years |
|----|-----------|----------|-------|
| sk1 | b1.. | s1 | 2 |

**resumes**:
| id | seeker_id | s3_key | raw_text |
|----|-----------|--------|----------|
| r1 | b1.. | resumes/ed307/res1.pdf | "2y Django exp..." |

### job_schema (Job Service)
**jobs**:
| id | recruiter_id | title | status |
|----|--------------|-------|--------|
| j1 | c1.. | Backend Dev | published |

### app_schema (Application Service)
**applications**:
| id | job_id | seeker_id | current_stage |
|----|--------|-----------|---------------|
| a1 | j1 | b1.. | screening |

**interviews**:
| id | application_id | jitsi_link | scheduled_at |
|----|----------------|------------|--------------|
| i1 | a1 | meet.jit.si/uuid | 2026-04-13 |

### match_schema (Matching Service)
**resume_embeddings**:
| resume_id | embedding | model_version |
|-----------|-----------|---------------|
| r1 | [0.1,0.2,...384dims] | all-MiniLM-L6-v2 |

### notification_schema
**notifications**:
| id | user_id | title | is_read |
|----|---------|-------|---------|
| n1 | ed307.. | Application stage changed | false |

**Test Data Load** (scripts/sample_data.sql):
docker exec -i jobportal_postgres psql -U jobportal_user jobportal_db < scripts/sample_data.sql

### 1. **Auth Service (8001) - Registration/Login Flow** ✅ **RIGHT** (core, no deps)

```
# Health check
curl http://localhost:8001/api/auth/health/
→ {"status": "ok", "service": "auth"}

# Register (triggers OTP email)
curl -X POST http://localhost:8001/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@yopmail.com", "password": "test123", "role": "seeker"}'
→ {"message": "Registered. Check email for OTP."}

# Verify OTP (check email spam for 6-digit code)
curl -X POST http://localhost:8001/api/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@yopmail.com", "otp_code": "123456"}'
→ {"message": "Email verified."}

# Login
curl -X POST http://localhost:8001/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@yopmail.com", "password": "test123"}'
→ {
  "access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "role": "seeker",
  "user_id": "uuid-here"
}

# Logout (JWT required)
curl -X POST http://localhost:8001/api/auth/logout/ \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<REFRESH_TOKEN>"}'
→ {"message": "Logged out."} (blacklists refresh in Redis)

# Forgot Password (sends OTP to email)
curl -X POST http://localhost:8001/api/auth/forgot-password/ \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@yopmail.com"}'
→ {"message": "Password reset OTP sent to email."}

# Reset Password (use OTP)
curl -X POST http://localhost:8001/api/auth/reset-password/ \
  -H "Content-Type: application/json" \
  -d '{"email": "newuser@yopmail.com", "otp_code": "654321", "new_password": "newpass123"}'
→ {"message": "Password reset successful."}

# Refresh Access Token
curl -X POST http://localhost:8001/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{"refresh": "<REFRESH_TOKEN>"}'
→ {"access": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."}
```
### 2. **Profile Service (8002) - Seeker Profile/Skills/Resume** ❌ **WRONG** (resume needs S3)

```
# Get seeker profile (JWT required)
curl -H "Authorization: Bearer <SEEKER_TOKEN>" \
  http://localhost:8002/api/profile/seeker/
→ {"first_name": "", "summary": "", ...}

# Create/Update seeker profile
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"first_name": "John", "last_name": "Doe"}' \
  http://localhost:8002/api/profile/seeker/
→ {"id": "uuid", "first_name": "John", "last_name": "Doe"}

# List all skills (global, no auth needed)
curl http://localhost:8002/api/profile/skills/
→ [{"id": "uuid", "name": "Python"}, {"id": "uuid2", "name": "Django"}]

# Add skill to profile
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"skill_name": "Python", "years_of_experience": 2}' \
  http://localhost:8002/api/profile/seeker/skills/
→ {"id": "uuid", "skill_name": "Python", "years_of_experience": 2}

# Add professional experience
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/
→ {"id": "uuid", "company": "Tech Inc", ...}

# Upload resume (S3 + Kafka event)
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  -F "resume_title=My Resume" -F "resume=@resume.pdf" \
  http://localhost:8002/api/profile/seeker/resumes/
→ {"id": "uuid", "s3_key": "resumes/seeker-uuid/resume.pdf", "parsing_status": "success"}

# Get presigned S3 URL for resume upload
curl -H "Authorization: Bearer <SEEKER_TOKEN>" \
  http://localhost:8002/api/profile/seeker/resumes/<RESUME_UUID>/url/
→ {"url": "https://s3.amazonaws.com/bucket...?X-Amz-...", "fields": {...}}

# Recruiter profile (role='recruiter')
curl -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8002/api/profile/recruiter/
→ {"company_name": "", "industry": "", "location": "Remote"}

# Update recruiter profile
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"company_name": "HirePro", "industry": "Tech", "location": "Remote"}' \
  http://localhost:8002/api/profile/recruiter/
→ {"company_name": "HirePro", "industry": "Tech", ...}
```
### 3. **Job Service (8003)** ✅ **RIGHT** (fully independent)

```
# Health check
curl http://localhost:8003/api/jobs/health/
→ {"status": "ok", "service": "jobs"}

# List all jobs
curl http://localhost:8003/api/jobs/
→ [{"id": "uuid", "title": "Django Dev", "status": "published", ...}]

# List job categories
curl http://localhost:8003/api/jobs/categories/
→ [{"id": "uuid", "name": "Backend", "description": "Server-side dev"}]

# Get job details
curl http://localhost:8003/api/jobs/<JOB_UUID>/
→ Full job details

# Create job (recruiter JWT required)
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"title": "Senior Django Dev", "description": "Build APIs", "location": "Remote", "salary_min": 80000}' \
  http://localhost:8003/api/jobs/create/
→ {"id": "job_uuid", "title": "Senior Django Dev", "status": "draft"}

# Get my jobs (recruiter)
curl -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8003/api/jobs/my/
→ [{"id": "job_uuid", "title": "...", "status": "draft"}]

# Publish job (triggers Kafka event)
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8003/api/jobs/<JOB_UUID>/publish/
→ {"message": "Job published", "id": "job_uuid"}

# Close job
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8003/api/jobs/<JOB_UUID>/close/
→ {"status": "closed"}

# Archive job
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8003/api/jobs/<JOB_UUID>/archive/
→ {"status": "archived"}

# Restore job
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8003/api/jobs/<JOB_UUID>/restore/
→ {"status": "published"}
```
### 4. **Application Service (8004)** ✅ **RIGHT** (interviews work!)

```
# Health check
curl http://localhost:8004/api/applications/health/
→ {"status": "ok"}

# Apply to job (seeker)
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"job_id": "<JOB_UUID>", "resume_id": "<RESUME_UUID>", "cover_letter": "Interested..."}' \
  http://localhost:8004/api/applications/apply/
→ {"id": "app_uuid", "status": "screening", "job_title": "..."}

# Get my applications (seeker)
curl -H "Authorization: Bearer <SEEKER_TOKEN>" \
  http://localhost:8004/api/applications/my/
→ [{"id": "app_uuid", "job_title": "Django Dev", "status": "screening"}]

# Get job applications (recruiter)
curl -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8004/api/applications/job/<JOB_UUID>/
→ [{"id": "app_uuid", "seeker_name": "John Doe", "status": "screening"}]

# Get application detail
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8004/api/applications/<APP_UUID>/
→ Full application details with timeline

# Update application stage (recruiter, triggers Kafka)
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"stage": "interview"}' \
  http://localhost:8004/api/applications/<APP_UUID>/stage/
→ {"stage": "interview", "updated_at": "..."}

# Schedule interview (Jitsi)
curl -X POST -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"scheduled_at": "2026-04-20T14:00:00Z"}' \
  http://localhost:8004/api/applications/<APP_UUID>/schedule-interview/
→ {"jitsi_link": "meet.jit.si/app-interview-uuid", "scheduled_at": "..."}

# Get interview details
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8004/api/applications/<APP_UUID>/interview/
→ {"jitsi_link": "meet.jit.si/...", "status": "scheduled"}

# Get application history
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8004/api/applications/<APP_UUID>/history/
→ [{"stage": "screening", "timestamp": "..."}, {"stage": "interview", ...}]

# Withdraw application (seeker)
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  http://localhost:8004/api/applications/<APP_UUID>/withdraw/
→ {"message": "Application withdrawn"}
```
### 5. **Matching Service (8005) - AI** ❌ **WRONG** (needs embeddings)

```
# Health check
curl http://localhost:8005/api/match/health/
→ {"status": "ok"}

# Get matching jobs for seeker (after resume uploaded + async embedding)
curl -H "Authorization: Bearer <SEEKER_TOKEN>" \
  http://localhost:8005/api/match/jobs-for-seeker/
→ [{"id": "job_uuid", "title": "...", "match_score": 0.85}, ...]

# Get matching seekers for job (recruiter, after embeddings)
curl -H "Authorization: Bearer <RECRUITER_TOKEN>" \
  http://localhost:8005/api/match/seekers-for-job/<JOB_UUID>/
→ [{"id": "seeker_uuid", "name": "John Doe", "match_score": 0.88}, ...]

# Embed resume (async via Kafka consumer)
curl -X POST -H "Authorization: Bearer <SEEKER_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"resume_id": "<RESUME_UUID>"}' \
  http://localhost:8005/api/match/embed/resume/
→ {"status": "embedding_queued"}

# Embed job (backend admin only)
curl -X POST http://localhost:8005/api/match/embed/job/ \
  -H "Content-Type: application/json" \
  -d '{"job_id": "<JOB_UUID>"}'
→ {"status": "embedded"}
```
### 6. **Notification Service (8006)** ✅ **RIGHT** (w/ Kafka events)

```
# Get notifications
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8006/api/notifications/
→ [{"id": "notif_uuid", "title": "Application received", "is_read": false}]

# Get unread count
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8006/api/notifications/unread-count/
→ {"count": 3}

# Mark single notification as read
curl -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8006/api/notifications/<NOTIF_UUID>/mark-read/
→ {"message": "Marked as read"}

# Mark all notifications as read
curl -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8006/api/notifications/mark-all-read/
→ {"message": "All notifications marked read"}

# Delete notification
curl -X DELETE -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8006/api/notifications/<NOTIF_UUID>/
→ {"message": "Notification deleted"}
```

### 7. **Chat Service (8007)** ✅ **RIGHT**

```
# List conversations
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8007/api/chat/conversations/
→ [{"id": "conv_uuid", "other_user": "...", "last_message": "..."}]

# Get messages in conversation
curl -H "Authorization: Bearer <ACCESS_TOKEN>" \
  http://localhost:8007/api/chat/conversations/<CONV_UUID>/messages/
→ [{"id": "msg_uuid", "sender": "...", "body": "...", "timestamp": "..."}]

# Send message
curl -X POST -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"recipient_id": "<RECIPIENT_UUID>", "body": "Hello!"}' \
  http://localhost:8007/api/chat/messages/send/
→ {"id": "msg_uuid", "body": "Hello!", "timestamp": "..."}
```

---

## **Quick Test Sequence**

1. **Auth**: Register → Verify OTP → Login → Get tokens
2. **Profile**: Create profile (seeker/recruiter) → Add skills
3. **Jobs**: Create job (recruiter) → Publish job
4. **Applications**: Apply to job (seeker) → View applications (recruiter)
5. **Interviews**: Schedule interview → Get Jitsi link
6. **Notifications**: Check notifications → Mark as read
7. **Chat**: Send message between users


2. Profile seeker/ + skills + resume → Kafka eventscurl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/
3. Jobs list
4. `docker logs jobportal_kafka` → see topics
5. `docker exec jobportal_redis redis-cli keys *` → sessions
curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/
curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/curl -X POST -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ0b2tlbl90eXBlIjoiYWNjZXNzIiwiZXhwIjoxNzc2MDE4NDU1LCJpYXQiOjE3NzYwMTQ4NTUsImp0aSI6ImJhOTEwMGI4NGYxYzQxNWJiY2RiMzExNzNhNzYzNmYxIiwidXNlcl9pZCI6ImVlNmU2ZDU1LTYzZTEtNDQyYy05MjM1LWZjMWRmNTkwNDFiYSIsInJvbGUiOiJzZWVrZXIiLCJlbWFpbCI6Imxwb2xwb2xwb2xwb0B5b3BtYWlsLmNvbSJ9.Nza__-aV074qZKsxveSihoa4UbWm9ejJhAOjBcwxvhc" -H "Content-Type: application/json" \
  -d '{"company": "Tech Inc", "title": "Developer", "start_date": "2021-01", "end_date": null}' \
  http://localhost:8002/api/profile/seeker/experience/