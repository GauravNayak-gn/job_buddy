# Work So Far

## [DONE] Phase 0 — Repo & Structure
- Created GitHub repo: https://github.com/pattewadshubham/Job-buddy
- Folder structure: backend/ (7 services), frontend/, nginx/, scripts/, docs/
- .gitignore — covers Python, Node, .env files
- README.md — project overview
- docs/ — architecture.md, database_schema.md, setup_guide.md

## [DONE] Phase 1 — Base Config Files
- scripts/init_db.sql — creates 7 schemas + pgvector on local PostgreSQL
- nginx/nginx.conf — API gateway routing all /api/* to correct service
- docker-compose.yml — spins up Redis, Kafka, Zookeeper, Nginx (DB is local)

---

## [NEXT] Phase 2 — Database Setup (Local PostgreSQL)
- Install PostgreSQL + pgvector on local machine
- Create DB: jobportal_db, user: jobportal_user
- Run init_db.sql to create all 7 schemas

## [ ] Phase 3 — auth_service (port 8001)
- Django project, JWT auth, OTP email verify, password reset
- Schema: auth_schema

## [ ] Phase 4 — profile_service (port 8002)
- Seeker/recruiter profiles, resume upload to S3, PyMuPDF text extract
- Schema: profile_schema

## [ ] Phase 5 — job_service (port 8003)
- Job CRUD, publish/close, Kafka event on publish
- Schema: job_schema

## [ ] Phase 6 — application_service (port 8004)
- Apply, stage pipeline, Jitsi interview scheduling
- Schema: app_schema

## [ ] Phase 7 — notification_service (port 8006)
- Kafka consumer, Gmail SMTP emails, in-app notifications
- Schema: notification_schema

## [ ] Phase 8 — matching_service (port 8005)
- Sentence Transformers, pgvector similarity search
- Schema: match_schema

## [ ] Phase 9 — chat_service (port 8007)
- Placeholder, Django Channels WebSocket stub
- Schema: chat_schema

## [ ] Phase 10 — Angular Frontend
- Single app in frontend/, all calls via Nginx /api/*
- Pages: auth, seeker dashboard, recruiter dashboard, notifications, AI match

## [ ] Phase 11 — Integration & Testing
- Full flow: register → apply → interview → email notification
- AI matching: upload resume → see matched jobs
