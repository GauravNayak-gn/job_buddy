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

## [ ] Phase 7 — notification_service (port 8006)
- Kafka consumer, Gmail SMTP emails, in-app notifications
- Schema: notification_schema

## [ ] Phase 8 — matching_service (port 8005)
- Sentence Transformers, pgvector similarity search
- Schema: match_schema

## [ ] Phase 9 — chat_service (port 8007)
- Placeholder, Django Channels WebSocket stub
- Schema: chat_schema

## [IN PROGRESS] Phase 10 — Angular Frontend
- Single app in frontend/, all calls via Nginx /api/*
- Angular app scaffold added with pages: home, jobs, login, post-job, profile
- Next: complete recruiter dashboard, seeker dashboard, notification bell, AI match page

## [ ] Phase 11 — Integration & Testing
- Full flow: register → apply → interview → email notification
- AI matching: upload resume → see matched jobs
