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

## [DONE] Phase 2 — Database Setup (Local PostgreSQL)
- PostgreSQL 18 installed and running on port 5432
- DB: jobportal_db, user: admin, password: job@123
- pgvector extension enabled
- 7 schemas created: auth_schema, profile_schema, job_schema, app_schema, match_schema, notification_schema, chat_schema

## [NEXT] Phase 3 — auth_service (port 8001)

## [DONE] Phase 3 — auth_service (port 8001)
- Django project, custom User model (UUID pk, role: seeker/recruiter/admin)
- Endpoints: register, verify-otp, login, logout, token/refresh, forgot-password, reset-password, health
- JWT via simplejwt, OTP via email, token blacklist via Redis
- Migrations applied to auth_schema, health check confirmed: {"status":"ok","service":"auth"}

## [DONE] Phase 4 — profile_service (port 8002)
- Seeker/recruiter profile CRUD, skills, experience
- Resume upload to S3, PyMuPDF text extraction, Kafka event on upload
- JWT validated via shared secret (no auth_service call needed)
- Migrations applied to profile_schema, health check confirmed

## [DONE] Phase 5 — job_service (port 8003)
- Job CRUD, publish/close, Kafka event on publish
- Schema: job_schema

## [IN PROGRESS] Phase 6 — application_service (port 8004)
- Django project + app scaffold completed
- Endpoints added: health, apply, my applications, job applications, detail, withdraw
- Stage pipeline endpoints added with history tracking + Kafka event publish
- Interview scheduling endpoint added with Jitsi link generation + Kafka event publish
- Schema: app_schema

## [IN PROGRESS] Phase 7 — notification_service (port 8006)
- Django service scaffold completed
- In-app notification model + APIs: list, unread count, mark-read, mark-all-read
- Kafka consumer command added for `application.stage_changed`, `interview.scheduled`, `user.registered`
- SMTP email utility added
- Schema: notification_schema

## [IN PROGRESS] Phase 8 — matching_service (port 8005)
- Django service scaffold completed
- Embedding storage models + Kafka consumer command for `resume.uploaded`, `job.published`
- Match APIs added: jobs-for-seeker, seekers-for-job
- Embedding generation supports Sentence Transformers with deterministic fallback
- Schema: match_schema

## [IN PROGRESS] Phase 9 — chat_service (port 8007)
- Django service scaffold completed
- Placeholder chat APIs added: conversations list/create, messages list/create
- Schema: chat_schema

## [IN PROGRESS] Phase 10 — Angular Frontend
- Single app in frontend/, all calls via Nginx /api/*
- Angular app scaffold added with pages: home, jobs, login, post-job, profile
- Notifications page + AI match page added with route/nav wiring
- Next: complete recruiter dashboard and seeker dashboard polish

## [ ] Phase 11 — Integration & Testing
- Full flow: register → apply → interview → email notification
- AI matching: upload resume → see matched jobs
