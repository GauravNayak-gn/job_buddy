# Job Buddy — Job Portal

A microservices-based job portal built with Django REST Framework, Angular, PostgreSQL, Redis, Kafka, Nginx, and AWS S3.

## Stack

- Frontend: Angular (single app)
- Backend: 7 Django microservices
- DB: PostgreSQL (local, schema-per-service)
- Cache: Redis
- Events: Apache Kafka
- Files: AWS S3
- Proxy: Nginx (API Gateway + Load Balancer)
- Video: Jitsi Meet
- AI Matching: Sentence Transformers (all-MiniLM-L6-v2)
  Structure

## Structure
```
Job-buddy/
├── backend/
│   ├── auth_service/          (port 8001)
│   ├── profile_service/       (port 8002)
│   ├── job_service/           (port 8003)
│   ├── application_service/   (port 8004)
│   ├── matching_service/      (port 8005)
│   ├── notification_service/  (port 8006)
│   └── chat_service/          (port 8007)
├── frontend/                  Angular app
├── nginx/                     nginx.conf
├── scripts/                   DB init SQL
├── docs/                      architecture, schema, setup
├── docker-compose.yml         infra only (Redis, Kafka, Nginx)
└── work_so_far.md             progress tracker
```

## Quick Start
See `docs/setup_guide.md`
