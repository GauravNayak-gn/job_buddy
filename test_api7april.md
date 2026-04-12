# API Testing Guide - 7 April 2026

This file is updated against the actual Django code in:

- `backend/auth_service/accounts/views.py`
- `backend/job_service/jobs/views.py`
- `backend/profile_service/profiles/views.py`

## Verification Status

- URL paths, payload fields, and response shapes below were checked against the backend code.
- Live API verification was **not completed in this workspace on April 7, 2026** because:
  - services on `localhost:8001`, `8002`, and `8003` were not running
  - PostgreSQL on `localhost:5432` was not responding
- Use this file as the corrected API contract and smoke-test checklist for your demo.

---

## Start the 3 Services

Run these in separate terminals after PostgreSQL and Redis are available:

```bash
# Terminal 1: Auth Service
cd /home/shubhamp@rhythm.local/Videos/MWA/Job-buddy/backend/auth_service
python manage.py runserver 8001

# Terminal 2: Profile Service
cd /home/shubhamp@rhythm.local/Videos/MWA/Job-buddy/backend/profile_service
python manage.py runserver 8002

# Terminal 3: Job Service
cd /home/shubhamp@rhythm.local/Videos/MWA/Job-buddy/backend/job_service
python manage.py runserver 8003
```

## Demo Accounts

```text
Seeker:
  Email: seeker1@jobbuddy.com
  Password: Test@1234

Recruiter:
  Email: recruiter1@jobbuddy.com
  Password: Test@1234
```

Important:

- Login only works for users whose `is_verified = True`.
- Freshly registered users must verify OTP before login.

---

## 1. Health Checks

```bash
curl http://localhost:8001/api/auth/health/
curl http://localhost:8002/api/profile/health/
curl http://localhost:8003/api/jobs/health/
```

Expected:

```json
{"status":"ok","service":"auth"}
{"status":"ok","service":"profile"}
{"status":"ok","service":"jobs"}
```

---

## 2. Auth Service

Base URL:

```text
http://localhost:8001/api/auth
```

### Register

```bash
curl -X POST http://localhost:8001/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@jobbuddy.com",
    "password": "Test@1234",
    "role": "seeker"
  }'
```

Payload:

```json
{
  "email": "string",
  "password": "min 6 chars",
  "role": "seeker or recruiter"
}
```

Success response:

```json
{
  "message": "Registered. Check email for OTP."
}
```

Possible errors:

```json
{"role":["Role must be seeker or recruiter."]}
{"email":["user with this email already exists."]}
```

### Verify OTP

```bash
curl -X POST http://localhost:8001/api/auth/verify-otp/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newuser@jobbuddy.com",
    "otp_code": "123456"
  }'
```

Success response:

```json
{
  "message": "Email verified."
}
```

Possible errors:

```json
{"error":"User not found."}
{"error":"Invalid or expired OTP."}
```

### Login

```bash
curl -X POST http://localhost:8001/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seeker1@jobbuddy.com",
    "password": "Test@1234"
  }'
```

Success response:

```json
{
  "access": "jwt-access-token",
  "refresh": "jwt-refresh-token",
  "role": "seeker",
  "user_id": "uuid"
}
```

Important:

- Login fails if email is not verified.

Possible errors:

```json
{"non_field_errors":["Invalid credentials."]}
{"non_field_errors":["Email not verified."]}
```

### Logout

```bash
curl -X POST http://localhost:8001/api/auth/logout/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "YOUR_REFRESH_TOKEN"
  }'
```

Success response:

```json
{
  "message": "Logged out."
}
```

### Forgot Password

```bash
curl -X POST http://localhost:8001/api/auth/forgot-password/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seeker1@jobbuddy.com"
  }'
```

Success response:

```json
{
  "message": "If that email exists, an OTP has been sent."
}
```

### Reset Password

This endpoint exists. `verify-otp/` does **not** reset the password.

```bash
curl -X POST http://localhost:8001/api/auth/reset-password/ \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seeker1@jobbuddy.com",
    "otp_code": "123456",
    "new_password": "Test@5678"
  }'
```

Success response:

```json
{
  "message": "Password reset successful."
}
```

Possible errors:

```json
{"error":"User not found."}
{"error":"Invalid or expired OTP."}
```

### Refresh Token

```bash
curl -X POST http://localhost:8001/api/auth/token/refresh/ \
  -H "Content-Type: application/json" \
  -d '{
    "refresh": "YOUR_REFRESH_TOKEN"
  }'
```

Typical response:

```json
{
  "access": "new-access-token"
}
```

---

## 3. Job Service

Base URL:

```text
http://localhost:8003/api/jobs
```

### Get Categories

```bash
curl http://localhost:8003/api/jobs/categories/
```

Response shape:

```json
[
  {
    "id": "uuid",
    "name": "Backend Development"
  }
]
```

### List Published Jobs

```bash
curl http://localhost:8003/api/jobs/
```

Optional filters:

```bash
curl "http://localhost:8003/api/jobs/?location_type=remote"
curl "http://localhost:8003/api/jobs/?category=Backend"
curl "http://localhost:8003/api/jobs/?search=Python"
curl "http://localhost:8003/api/jobs/?location_type=remote&category=Backend&search=Developer"
```

Response shape:

```json
[
  {
    "id": "uuid",
    "category": "category-uuid-or-null",
    "skills": [
      {
        "id": "uuid",
        "skill_name": "Python",
        "is_required": true
      }
    ],
    "title": "Django Backend Developer",
    "slug": "django-backend-developer-ab12cd34",
    "description": "Looking for experienced Django developer",
    "location_type": "remote",
    "location_city": "Bengaluru",
    "salary_min": 100000,
    "salary_max": 150000,
    "currency": "INR",
    "experience_required": "3 years",
    "status": "published",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

### Get Job Details

```bash
curl http://localhost:8003/api/jobs/JOB_ID/
```

Success response:

```json
{
  "id": "uuid",
  "category": "uuid-or-null",
  "skills": [],
  "title": "Job title",
  "slug": "job-title-1234abcd",
  "description": "Job description",
  "location_type": "remote",
  "location_city": "Mumbai",
  "salary_min": 100000,
  "salary_max": 150000,
  "currency": "INR",
  "experience_required": "3 years",
  "status": "draft or published or closed",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Not found:

```json
{"error":"Job not found."}
```

### Create Job

Recruiter token required.

```bash
curl -X POST http://localhost:8003/api/jobs/create/ \
  -H "Authorization: Bearer YOUR_RECRUITER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Django Backend Developer",
    "description": "Looking for experienced Django developer",
    "category": "CATEGORY_UUID",
    "location_type": "remote",
    "location_city": "Bengaluru",
    "salary_min": 100000,
    "salary_max": 150000,
    "currency": "INR",
    "experience_required": "3 years",
    "skills": [
      {"skill_name": "Python", "is_required": true},
      {"skill_name": "Django", "is_required": true}
    ]
  }'
```

Important correction:

- The correct field is `category`, not `category_id`.

Success response:

```json
{
  "id": "uuid",
  "category": "CATEGORY_UUID",
  "skills": [
    {
      "id": "uuid",
      "skill_name": "Python",
      "is_required": true
    }
  ],
  "title": "Django Backend Developer",
  "slug": "django-backend-developer-ab12cd34",
  "description": "Looking for experienced Django developer",
  "location_type": "remote",
  "location_city": "Bengaluru",
  "salary_min": 100000,
  "salary_max": 150000,
  "currency": "INR",
  "experience_required": "3 years",
  "status": "draft",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Forbidden for seekers:

```json
{"error":"Only recruiters can post jobs."}
```

### Recruiter Job List

```bash
curl -H "Authorization: Bearer YOUR_RECRUITER_ACCESS_TOKEN" \
  http://localhost:8003/api/jobs/my/
```

Response:

```json
[
  {
    "id": "uuid",
    "category": "uuid-or-null",
    "skills": [],
    "title": "Job title",
    "slug": "job-title-1234abcd",
    "description": "Job description",
    "location_type": "remote",
    "location_city": "Mumbai",
    "salary_min": 100000,
    "salary_max": 150000,
    "currency": "INR",
    "experience_required": "3 years",
    "status": "draft",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

### Update Job

Owner recruiter token required in practice.

```bash
curl -X PATCH http://localhost:8003/api/jobs/JOB_ID/ \
  -H "Authorization: Bearer YOUR_RECRUITER_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Senior Django Developer",
    "salary_min": 120000
  }'
```

Response:

```json
{
  "id": "uuid",
  "category": "uuid-or-null",
  "skills": [],
  "title": "Senior Django Developer",
  "slug": "existing-slug",
  "description": "Job description",
  "location_type": "remote",
  "location_city": "Mumbai",
  "salary_min": 120000,
  "salary_max": 150000,
  "currency": "INR",
  "experience_required": "3 years",
  "status": "draft",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Publish Job

```bash
curl -X POST http://localhost:8003/api/jobs/JOB_ID/publish/ \
  -H "Authorization: Bearer YOUR_RECRUITER_ACCESS_TOKEN"
```

Response:

```json
{"message":"Job published."}
```

### Close Job

```bash
curl -X POST http://localhost:8003/api/jobs/JOB_ID/close/ \
  -H "Authorization: Bearer YOUR_RECRUITER_ACCESS_TOKEN"
```

Response:

```json
{"message":"Job closed."}
```

---

## 4. Profile Service

Base URL:

```text
http://localhost:8002/api/profile
```

### Get Skill Catalog

```bash
curl http://localhost:8002/api/profile/skills/
```

Response:

```json
[
  {
    "id": "uuid",
    "name": "Python"
  }
]
```

### Get Seeker Profile

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8002/api/profile/seeker/
```

Success response:

```json
{
  "id": "uuid",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+91-9876543210",
  "current_title": "Full Stack Developer",
  "summary": "Experienced developer",
  "github_url": "https://github.com/janesmith",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "profile_picture_key": "",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

Not found:

```json
{"error":"Profile not found."}
```

### Create Seeker Profile

```bash
curl -X POST http://localhost:8002/api/profile/seeker/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "last_name": "Smith",
    "phone": "+91-9876543210",
    "current_title": "Full Stack Developer",
    "summary": "Experienced developer with 5 years in web development",
    "github_url": "https://github.com/janesmith",
    "linkedin_url": "https://linkedin.com/in/janesmith"
  }'
```

Success response:

```json
{
  "id": "uuid",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+91-9876543210",
  "current_title": "Full Stack Developer",
  "summary": "Experienced developer with 5 years in web development",
  "github_url": "https://github.com/janesmith",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "profile_picture_key": "",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Update Seeker Profile

```bash
curl -X PATCH http://localhost:8002/api/profile/seeker/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "current_title": "Senior Full Stack Developer",
    "phone": "+91-9876543211"
  }'
```

Response:

```json
{
  "id": "uuid",
  "first_name": "Jane",
  "last_name": "Smith",
  "phone": "+91-9876543211",
  "current_title": "Senior Full Stack Developer",
  "summary": "Experienced developer with 5 years in web development",
  "github_url": "https://github.com/janesmith",
  "linkedin_url": "https://linkedin.com/in/janesmith",
  "profile_picture_key": "",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Get Recruiter Profile

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8002/api/profile/recruiter/
```

Success response:

```json
{
  "id": "uuid",
  "company_name": "Tech Solutions Ltd",
  "company_size": "51-200",
  "industry": "Software Development",
  "hq_location": "Mumbai, India",
  "website_url": "https://techsolutions.com",
  "company_logo_key": "",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Create Recruiter Profile

```bash
curl -X POST http://localhost:8002/api/profile/recruiter/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Tech Solutions Ltd",
    "company_size": "51-200",
    "industry": "Software Development",
    "hq_location": "Mumbai, India",
    "website_url": "https://techsolutions.com"
  }'
```

Success response:

```json
{
  "id": "uuid",
  "company_name": "Tech Solutions Ltd",
  "company_size": "51-200",
  "industry": "Software Development",
  "hq_location": "Mumbai, India",
  "website_url": "https://techsolutions.com",
  "company_logo_key": "",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### Update Recruiter Profile

```bash
curl -X PATCH http://localhost:8002/api/profile/recruiter/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_size": "200+",
    "industry": "Enterprise Software"
  }'
```

### Get Seeker Skills

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8002/api/profile/seeker/skills/
```

Response:

```json
[
  {
    "id": "uuid",
    "skill": "skill-uuid",
    "skill_name": "Python",
    "years_of_experience": 5
  }
]
```

### Add Seeker Skill

```bash
curl -X POST http://localhost:8002/api/profile/seeker/skills/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "skill_name": "Python",
    "years_of_experience": 5
  }'
```

Important corrections:

- The backend expects `skill_name`, not `skill_id`.
- There is **no PATCH endpoint** for seeker skills in the current code.

Response:

```json
{
  "id": "uuid",
  "skill": "skill-uuid",
  "skill_name": "Python",
  "years_of_experience": 5
}
```

### Get Experience

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8002/api/profile/seeker/experience/
```

Response:

```json
[
  {
    "id": "uuid",
    "company_name": "Google India",
    "role_title": "Software Engineer",
    "start_date": "2022-01-15",
    "end_date": null,
    "description": "Working on backend systems and microservices",
    "created_at": "datetime",
    "updated_at": "datetime"
  }
]
```

### Add Experience

```bash
curl -X POST http://localhost:8002/api/profile/seeker/experience/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "company_name": "Google India",
    "role_title": "Software Engineer",
    "start_date": "2022-01-15",
    "end_date": null,
    "description": "Working on backend systems and microservices"
  }'
```

Response:

```json
{
  "id": "uuid",
  "company_name": "Google India",
  "role_title": "Software Engineer",
  "start_date": "2022-01-15",
  "end_date": null,
  "description": "Working on backend systems and microservices",
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

### List Resumes

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8002/api/profile/seeker/resumes/
```

Response:

```json
[
  {
    "id": "uuid",
    "resume_title": "My Resume",
    "is_primary": true,
    "parsing_status": "success",
    "file_size_bytes": 184320,
    "created_at": "datetime"
  }
]
```

### Upload Resume

```bash
curl -X POST http://localhost:8002/api/profile/seeker/resumes/ \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -F "resume_title=My Resume" \
  -F "resume=@/absolute/path/to/resume.pdf"
```

Important correction:

- The uploaded file field must be `resume`, not `resume_file`.

Success response:

```json
{
  "id": "uuid",
  "resume_title": "My Resume",
  "is_primary": true,
  "parsing_status": "success",
  "file_size_bytes": 184320,
  "created_at": "datetime"
}
```

Possible errors:

```json
{"error":"PDF file required."}
{"error":"S3 upload failed: ..."}
```

### Get Resume Presigned URL

```bash
curl -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  http://localhost:8002/api/profile/seeker/resumes/RESUME_ID/url/
```

Response:

```json
{
  "url": "https://signed-s3-url..."
}
```

---

## Quick Smoke Test Script

Save this as `test_apis.sh`:

```bash
#!/bin/bash

AUTH_URL="http://localhost:8001/api/auth"
PROFILE_URL="http://localhost:8002/api/profile"
JOB_URL="http://localhost:8003/api/jobs"

echo "1. Health checks"
curl -s $AUTH_URL/health/; echo
curl -s $PROFILE_URL/health/; echo
curl -s $JOB_URL/health/; echo

echo
echo "2. Login as seeker"
LOGIN_RESPONSE=$(curl -s -X POST $AUTH_URL/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"seeker1@jobbuddy.com","password":"Test@1234"}')

echo "$LOGIN_RESPONSE"

ACCESS_TOKEN=$(echo "$LOGIN_RESPONSE" | grep -o '"access":"[^"]*"' | cut -d'"' -f4)

echo
echo "3. Public job data"
curl -s $JOB_URL/categories/; echo
curl -s "$JOB_URL/?location_type=remote"; echo

echo
echo "4. Public profile data"
curl -s $PROFILE_URL/skills/; echo

echo
echo "5. Protected seeker data"
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" $PROFILE_URL/seeker/; echo
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" $PROFILE_URL/seeker/skills/; echo
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" $PROFILE_URL/seeker/experience/; echo

echo
echo "Done"
```

Run:

```bash
bash test_apis.sh
```

---

## Demo Notes for Teacher

Use these points during explanation:

- This is a microservices project with separate auth, profile, and job services.
- Angular acts as one frontend for all three services.
- Auth issues JWT tokens.
- Profile and Job services trust the JWT payload and use the `user_id` and `role`.
- Public browsing works without auth.
- Recruiter-only job creation is enforced in the Job service.

Current backend gaps you should know before demo:

- The old markdown used some wrong fields; this file fixes them.
- `reset-password/` exists and should be used after `forgot-password/`.
- `seeker/skills/` supports `GET` and `POST`, but not `PATCH`.
- Resume upload expects `resume` multipart field.
- Profile endpoints require authentication, but current code does not strictly enforce seeker vs recruiter role separation.
















----------------------------
`matching_service` currently works in 3 paths:

1. Direct embedding APIs:
- `POST /api/match/embed/resume/` stores seeker resume embedding.
- `POST /api/match/embed/job/` stores job embedding.

2. Query APIs:
- `GET /api/match/jobs-for-seeker/<seeker_id>/`
- `GET /api/match/seekers-for-job/<job_id>/`
These return cosine-similarity ranked results.

3. Kafka consumer path:
- Listens to `resume.uploaded` and `job.published`
- Auto-creates embeddings from events.

In my E2E run, matching returned empty until embeddings existed; after explicit `embed/resume` + `embed/job`, it returned valid matches. So matching logic is working, but event-driven population needs a bit more hardening/verification in your setup.

For S3: no, not just “any creds”.
You need:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_STORAGE_BUCKET_NAME`
- `AWS_S3_REGION_NAME`
- IAM permission to `PutObject`/`GetObject` on that bucket
- Existing bucket in that region

So yes, creds are part of it, but bucket + IAM permissions must also be correct.