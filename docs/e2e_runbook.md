# Job Buddy E2E Runbook

This is the single file to run and test the project end-to-end on your machine.

## 1) Current implementation status

Implemented and runnable:
- Auth service (`8001`)
- Profile service (`8002`)
- Job service (`8003`)
- Application service (`8004`)
- Matching service (`8005`)
- Notification service (`8006`)
- Chat placeholder service (`8007`)
- Angular frontend (`frontend/`)

Notes:
- Auth JWT now includes `role` claim (required by downstream services).
- `user.registered` Kafka event is published from auth register.
- Notification consumer sends welcome email for `user.registered` when SMTP env is set.
- Resume upload requires valid S3 config (bucket + IAM). If S3 is not configured, skip resume upload tests.

## 2) Required dependencies

Mandatory:
- PostgreSQL (db: `jobportal_db`, user: `admin`, password: `job@123`)

Recommended for full flow:
- Redis
- Kafka + Zookeeper

## 3) Infra startup

From repo root:

```bash
docker compose up -d redis zookeeper kafka
```

Verify:

```bash
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'
```

## 4) Database setup

Run once (or rerun safely):

```bash
PGPASSWORD='job@123' psql -h 127.0.0.1 -U admin -d jobportal_db -f scripts/init_db.sql
```

## 5) Environment files

Use these `.env` files per service:
- `backend/auth_service/.env`
- `backend/profile_service/.env`
- `backend/job_service/.env`
- `backend/application_service/.env`
- `backend/matching_service/.env`
- `backend/notification_service/.env`
- `backend/chat_service/.env`

Important:
- Keep secrets only in `.env` (already gitignored).
- For S3 tests, set valid AWS values in `backend/profile_service/.env`:
  - `AWS_ACCESS_KEY_ID`
  - `AWS_SECRET_ACCESS_KEY`
  - `AWS_STORAGE_BUCKET_NAME`
  - `AWS_S3_REGION_NAME`

## 6) Migrations

```bash
cd backend/auth_service && ./.venv/bin/python manage.py migrate --noinput
cd ../profile_service && ./venv/bin/python manage.py migrate --noinput
cd ../job_service && ./venv/bin/python manage.py migrate --noinput

cd ../application_service && ../auth_service/.venv/bin/python manage.py migrate --noinput
cd ../matching_service && ../auth_service/.venv/bin/python manage.py migrate --noinput
cd ../notification_service && ../auth_service/.venv/bin/python manage.py migrate --noinput
cd ../chat_service && ../auth_service/.venv/bin/python manage.py migrate --noinput
```

## 7) Start backend services (7 terminals)

```bash
# T1
cd backend/auth_service && ./.venv/bin/python manage.py runserver 127.0.0.1:8001

# T2
cd backend/profile_service && ./venv/bin/python manage.py runserver 127.0.0.1:8002

# T3
cd backend/job_service && ./venv/bin/python manage.py runserver 127.0.0.1:8003

# T4
cd backend/application_service && ../auth_service/.venv/bin/python manage.py runserver 127.0.0.1:8004

# T5
cd backend/matching_service && ../auth_service/.venv/bin/python manage.py runserver 127.0.0.1:8005

# T6
cd backend/notification_service && ../auth_service/.venv/bin/python manage.py runserver 127.0.0.1:8006

# T7
cd backend/chat_service && ../auth_service/.venv/bin/python manage.py runserver 127.0.0.1:8007
```

Start consumers (2 more terminals):

```bash
# T8
cd backend/notification_service && ../auth_service/.venv/bin/python manage.py consume_events

# T9
cd backend/matching_service && ../auth_service/.venv/bin/python manage.py consume_events
```

## 8) Health checks

```bash
curl http://127.0.0.1:8001/api/auth/health/
curl http://127.0.0.1:8002/api/profile/health/
curl http://127.0.0.1:8003/api/jobs/health/
curl http://127.0.0.1:8004/api/applications/health/
curl http://127.0.0.1:8005/api/match/health/
curl http://127.0.0.1:8006/api/notifications/health/
curl http://127.0.0.1:8007/api/chat/health/
```

## 9) Seed/demo users

Register both users (or use existing):

```bash
curl -X POST http://127.0.0.1:8001/api/auth/register/ -H 'Content-Type: application/json' -d '{"email":"seeker1@jobbuddy.com","password":"Test@1234","role":"seeker"}'
curl -X POST http://127.0.0.1:8001/api/auth/register/ -H 'Content-Type: application/json' -d '{"email":"recruiter1@jobbuddy.com","password":"Test@1234","role":"recruiter"}'
```

Mark verified directly (dev shortcut):

```bash
PGPASSWORD='job@123' psql -h 127.0.0.1 -U admin -d jobportal_db -c "SET search_path TO auth_schema; UPDATE users SET is_verified=true WHERE email IN ('seeker1@jobbuddy.com','recruiter1@jobbuddy.com');"
```

Login to get tokens:

```bash
curl -X POST http://127.0.0.1:8001/api/auth/login/ -H 'Content-Type: application/json' -d '{"email":"seeker1@jobbuddy.com","password":"Test@1234"}'
curl -X POST http://127.0.0.1:8001/api/auth/login/ -H 'Content-Type: application/json' -d '{"email":"recruiter1@jobbuddy.com","password":"Test@1234"}'
```

## 10) E2E API flow to test manually

Use recruiter token:
1. `POST /api/jobs/create/`
2. `POST /api/jobs/<job_id>/publish/`

Use seeker token:
1. `POST /api/applications/apply/`

Use recruiter token:
1. `POST /api/applications/<application_id>/stage/`
2. `POST /api/applications/<application_id>/schedule-interview/`

Then seeker token:
1. `GET /api/notifications/unread-count/`
2. `GET /api/notifications/`

Matching checks:
1. `GET /api/match/jobs-for-seeker/<seeker_id>/`
2. `GET /api/match/seekers-for-job/<job_id>/`

If matching returns empty initially, call:
- `POST /api/match/embed/resume/`
- `POST /api/match/embed/job/`
then retry the `GET` match endpoints.

Chat placeholder checks:
1. `POST /api/chat/conversations/`
2. `POST /api/chat/conversations/<conversation_id>/messages/`

## 11) Frontend run

```bash
cd frontend
npm install
npm run start
```

Open `http://localhost:4200`.

Main pages:
- `/login`
- `/profile`
- `/jobs`
- `/post-job`
- `/notifications`
- `/matches`

## 12) What is still not production-complete

- S3 resume upload requires real AWS bucket/IAM and should be tested with real credentials.
- Matching currently stores vectors as text (works for now); true pgvector native query/index optimization is pending.
- Chat is placeholder REST, not full websocket chat.
- Consumer/process supervision is manual (dev mode).
