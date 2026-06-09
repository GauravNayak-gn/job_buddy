# Setup Guide

> **Job Buddy** — Complete development environment setup and installation instructions.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Quick Start (TL;DR)](#2-quick-start-tldr)
3. [PostgreSQL Setup](#3-postgresql-setup)
4. [Infrastructure Setup (Docker)](#4-infrastructure-setup-docker)
5. [Backend Services Setup](#5-backend-services-setup)
6. [Frontend Setup](#6-frontend-setup)
7. [Health Verification](#7-health-verification)
8. [Common Issues & Troubleshooting](#8-common-issues--troubleshooting)
9. [Environment Variables Reference](#9-environment-variables-reference)
10. [Useful Commands](#10-useful-commands)

---

## 1. Prerequisites

### Required Software

| Software | Version | Purpose | Installation Check |
|----------|---------|---------|-------------------|
| **Python** | 3.10+ | Backend runtime | `python3 --version` |
| **Node.js** | 20+ | Frontend runtime | `node --version` |
| **PostgreSQL** | 16+ | Database | `psql --version` |
| **Docker** | 24+ | Infrastructure containers | `docker --version` |
| **Docker Compose** | 2.x | Container orchestration | `docker compose version` |
| **Angular CLI** | 20+ | Frontend development | `ng version` |

### Optional but Recommended

| Tool | Purpose |
|------|---------|
| **pgAdmin** or **DBeaver** | Database GUI for inspecting schemas |
| **Redis Insight** | Redis GUI for viewing cache/keys |
| **Kafka UI** (e.g., Kafdrop, AKHQ) | Kafka topic management |
| **Postman** or **Bruno** | API testing |
| **Python virtualenv** | Isolated Python environments |

### Port Requirements

Ensure these ports are free (not used by other services):

| Port | Service | Purpose |
|------|---------|---------|
| 5432 | PostgreSQL | Database |
| 6379 | Redis | Cache, broker, rate limiting |
| 9092 | Kafka | Event bus |
| 2181 | Zookeeper | Kafka coordination |
| 80 | Nginx | API Gateway |
| 4200 | Angular Dev Server | Frontend (dev) |
| 8001-8007 | Backend Services | 7 Django services |

---

## 2. Quick Start (TL;DR)

```bash
# 1. Clone
git clone <repo-url>
cd job-buddy

# 2. Database
psql -U postgres -c "CREATE DATABASE jobportal_db;"
psql -U postgres -d jobportal_db -f scripts/init_db.sql

# 3. Infrastructure
docker-compose up -d

# 4. Set up ONE backend service (example: auth)
cd backend/auth_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # edit if needed
python manage.py migrate
python manage.py runserver 0.0.0.0:8001 &

# 5. Repeat step 4 for all 7 services (or use start_backends.sh)

# 6. Frontend
cd frontend
npm install
ng serve

# 7. Verify
curl http://localhost:80/api/auth/health/
# → {"status": "healthy"}
```

---

## 3. PostgreSQL Setup

### 3.1 Install PostgreSQL (Ubuntu/Debian)

```bash
# Add PostgreSQL repository
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc

sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16 postgresql-16-pgvector

# Start PostgreSQL
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

### 3.2 Install PostgreSQL (macOS)

```bash
brew install postgresql@16 pgvector
brew services start postgresql@16
```

### 3.3 Install PostgreSQL (Windows)

Download from [EnterpriseDB](https://www.postgresql.org/download/windows/) and install. Ensure pgvector is installed via Stack Builder or manually.

### 3.4 Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# In psql shell:
CREATE USER admin WITH PASSWORD 'job@123';
CREATE DATABASE jobportal_db OWNER admin;
\c jobportal_db

# Verify pgvector extension is available
SELECT * FROM pg_available_extensions WHERE name = 'vector';
-- If not available, install it:
-- CREATE EXTENSION vector;

\q
```

### 3.5 Initialize Schemas

```bash
# Run from the project root
psql -U admin -d jobportal_db -f scripts/init_db.sql
```

This creates:
- 7 schemas: `auth_schema`, `profile_schema`, `job_schema`, `app_schema`, `match_schema`, `notification_schema`, `chat_schema`
- Grants all privileges to the `admin` user
- Enables pgvector extension

### 3.6 Verify Database Setup

```bash
# Run the diagnostic script
python check_db_connection.py
```

Expected output:
```
============================================================
  Job-Buddy Backend Database Connectivity Check
============================================================

============================================================
  1. PostgreSQL Connection Check
============================================================
✓ Connected to PostgreSQL
  Version: PostgreSQL 16.x

============================================================
  2. Schema Verification
============================================================
✓ auth_service               → auth_schema
✓ profile_service            → profile_schema
✓ job_service                → job_schema
✓ application_service        → app_schema
✓ notification_service       → notification_schema
✓ chat_service               → chat_schema
✓ matching_service           → match_schema

============================================================
  4. Environment Files Check
============================================================
✗ auth_service               → .env file NOT found
...
```

---

## 4. Infrastructure Setup (Docker)

### 4.1 Start Infrastructure

```bash
# From project root
docker-compose up -d
```

This starts:
- **Redis** (port 6379) — caching, Celery broker, rate limiting
- **Zookeeper** (port 2181) — Kafka coordination
- **Kafka** (port 9092) — event bus
- **Nginx** (port 80) — API gateway

### 4.2 Verify Infrastructure

```bash
# Check all containers are running
docker ps

# Expected output (4 containers):
# jobportal_nginx, jobportal_kafka, jobportal_zookeeper, jobportal_redis

# Check Redis
redis-cli ping
# → PONG

# Check Kafka (via Kafka CLI or netcat)
nc -z localhost 9092 && echo "Kafka OK"

# Check Nginx
curl -s -o /dev/null -w "%{http_code}" http://localhost:80
# → 000 (no routing match, but Nginx is listening)

# Check Nginx health more directly
curl -s http://localhost:80/api/auth/health/
# → If auth service not running yet: 502 Bad Gateway (Nginx is working)
```

### 4.3 Stop Infrastructure

```bash
docker-compose down
```

### 4.4 View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f kafka
docker-compose logs -f redis

# Follow Kafka messages (requires kcat/kafkacat)
kcat -C -b localhost:9092 -t resume.uploaded
```

---

## 5. Backend Services Setup

### 5.1 Setup Script (Automated)

```bash
# Start all 7 backend services
bash scripts/start_backends.sh

# Stop all 7 backend services
bash scripts/stop_backends.sh
```

### 5.2 Manual Setup (Per Service)

Repeat these steps for each of the 7 services. **Order matters** for migrations (apply migrations from most independent to most dependent).

**Suggested order**: auth → profile → job → application → matching → notification → chat

```bash
# Step 1: Navigate to service directory
cd backend/auth_service

# Step 2: Create virtual environment
python3 -m venv venv

# Step 3: Activate virtual environment
source venv/bin/activate  # Linux/macOS
# .\venv\Scripts\activate  # Windows

# Step 4: Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Step 5: Create .env file
cp .env.example .env
# Edit .env with your configuration (see section 9)

# Step 6: Run database migrations
python manage.py migrate

# Step 7: Start the service
python manage.py runserver 0.0.0.0:8001

# Step 8: Verify
curl http://localhost:8001/api/auth/health/
```

### 5.3 Service Port Map

| Service | Directory | Port | Schema | Migrate Order |
|---------|-----------|------|--------|---------------|
| Auth | `backend/auth_service/` | 8001 | `auth_schema` | 1st |
| Profile | `backend/profile_service/` | 8002 | `profile_schema` | 2nd |
| Job | `backend/job_service/` | 8003 | `job_schema` | 3rd |
| Application | `backend/application_service/` | 8004 | `app_schema` | 4th |
| Matching | `backend/matching_service/` | 8005 | `match_schema` | 5th |
| Notification | `backend/notification_service/` | 8006 | `notification_schema` | 6th |
| Chat | `backend/chat_service/` | 8007 | `chat_schema` | 7th |

### 5.4 Requirements Files

Each service has its own `requirements.txt`. Common packages across all services:

```
django==5.2.12
djangorestframework==3.17.1
django-cors-headers
django-pgvector
psycopg2-binary
python-decouple
redis
kafka-python==2.3.0
celery==5.4.0
PyJWT==2.10.1
```

Service-specific packages:

| Service | Additional Packages |
|---------|-------------------|
| Auth | `djangorestframework-simplejwt` |
| Profile | `PyMuPDF`, `boto3` |
| Job | (common only) |
| Application | (common only) |
| Matching | `sentence-transformers`, `google-generativeai`, `numpy` |
| Notification | (common only) |
| Chat | `channels` (ASGI/WebSocket) |

### 5.5 Starting Kafka Consumers

Two services run long-running Kafka consumer processes:

```bash
# Terminal 1: Matching Service consumer (for embedding generation)
cd backend/matching_service
source venv/bin/activate
python manage.py consume_events &

# Terminal 2: Notification Service consumer (for event processing)
cd backend/notification_service
source venv/bin/activate
python manage.py consume_events &
```

### 5.6 Starting Celery Workers

```bash
# Start Celery worker for a specific service
cd backend/auth_service
source venv/bin/activate
celery -A auth_service worker -l info &

# Or for all services (in separate terminals)
celery -A auth_service worker -l info &
celery -A profile_service worker -l info &
celery -A job_service worker -l info &
celery -A application_service worker -l info &
celery -A chat_service worker -l info &
```

### 5.7 Seeding Dummy Data

```bash
# Create dummy job listings (for testing)
cd backend/job_service
source venv/bin/activate
python create_dummy_jobs.py

# Sync missing embeddings for existing jobs
cd backend/matching_service
source venv/bin/activate
python sync_embeddings.py
```

---

## 6. Frontend Setup

### 6.1 Install Angular CLI

```bash
# Install Angular CLI globally (if not already)
npm install -g @angular/cli

# Verify
ng version
# → Angular CLI: 20.x.x
# → Node: 20.x.x
```

### 6.2 Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 6.3 Start Development Server

```bash
cd frontend
ng serve
```

This starts the Angular dev server on `http://localhost:4200`.

### 6.4 Proxy Configuration

The frontend uses a proxy configuration (`proxy.conf.json`) to forward API requests to Nginx:

```json
{
  "/api/": {
    "target": "http://localhost:80",
    "pathRewrite": { "^/api/": "/api/" },
    "changeOrigin": true,
    "secure": false,
    "logLevel": "debug",
    "ws": true
  }
}
```

This is configured in `angular.json`:
```json
"serve": {
  "builder": "@angular/build:dev-server",
  "options": {
    "proxyConfig": "proxy.conf.json"
  }
}
```

### 6.5 Production Build

```bash
cd frontend
ng build --configuration production
```

Output goes to `frontend/dist/`. Serve with Nginx or any static file server.

---

## 7. Health Verification

### 7.1 Run Health Check Script

```bash
bash health_check.sh
```

This checks:
1. Database connectivity per schema (table count)
2. Service port status (running or not)
3. `.env` file presence
4. Redis, Kafka, PostgreSQL connectivity

### 7.2 Verify Individual Service Health

```bash
curl http://localhost:8001/api/auth/health/
curl http://localhost:8002/api/profile/health/
curl http://localhost:8003/api/jobs/health/
curl http://localhost:8004/api/applications/health/
curl http://localhost:8005/api/match/health/
curl http://localhost:8006/api/notifications/health/
curl http://localhost:8007/api/chat/health/
```

Each should return: `{"status": "healthy"}` or similar.

### 7.3 Verify via Nginx Gateway

```bash
curl http://localhost:80/api/auth/health/
curl http://localhost:80/api/jobs/health/
curl http://localhost:80/api/chat/health/
```

### 7.4 Run Database Diagnostic

```bash
python check_db_connection.py
```

### 7.5 Verify Full Stack Flow

```bash
# 1. Register a user
curl -X POST http://localhost:80/api/auth/register/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test@123", "role": "seeker"}'

# 2. Login
curl -X POST http://localhost:80/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "Test@123"}'
```

---

## 8. Common Issues & Troubleshooting

### 8.1 Database Connection Issues

```
Error: could not connect to server: Connection refused
    Is the server running on host "localhost" (::1) and accepting
    TCP/IP connections on port 5432?
```

**Solutions**:
```bash
# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL port
sudo ss -tlnp | grep 5432

# Check pg_hba.conf for TCP/IP connections
sudo grep -n "listen_addresses" /etc/postgresql/16/main/postgresql.conf
# Should be: listen_addresses = '*'

# Check pg_hba.conf for password auth
sudo grep -n "host" /etc/postgresql/16/main/pg_hba.conf
# Should include: host all all 127.0.0.1/32 md5
```

### 8.2 Docker Infrastructure Not Starting

```bash
# Check logs
docker-compose logs

# Common fix: restart Docker daemon
sudo systemctl restart docker

# Rebuild containers
docker-compose down -v
docker-compose up -d
```

### 8.3 Kafka Connection Issues

```
Error: NoBrokersAvailable
```

**Solutions**:
```bash
# Check if Kafka container is running
docker ps | grep kafka

# Check Kafka logs
docker-compose logs kafka

# Verify listener configuration
# The docker-compose.yml uses:
# KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
# Services connecting from host should use localhost:9092
```

### 8.4 Redis Connection Issues

```
Error: Error 111 connecting to localhost:6379. Connection refused.
```

**Solutions**:
```bash
# Check if Redis container is running
docker ps | grep redis

# Check Redis logs
docker-compose logs redis

# Try connecting directly
redis-cli ping
```

### 8.5 Migration Errors

```
django.db.utils.ProgrammingError: relation "users" does not exist
```

**Solutions**:
```bash
# Ensure migrations are run in the correct order
cd backend/auth_service && python manage.py migrate
cd backend/profile_service && python manage.py migrate
# ... etc

# If a migration failed, try:
python manage.py migrate --fake-initial
# Or reset the schema and start fresh
```

### 8.6 Port Conflicts

```
Error: That port is already in use
```

**Solutions**:
```bash
# Find what's using the port
sudo lsof -i :8001

# Kill the process
kill -9 <PID>

# Or use a different port
python manage.py runserver 0.0.0.0:8001
```

### 8.7 Sentence Transformers Download Issues

```
Error: Connection error downloading all-MiniLM-L6-v2
```

**Solutions**:
```bash
# The model will be downloaded on first use. If behind a proxy:
export HTTP_PROXY=http://proxy:port
export HTTPS_PROXY=http://proxy:port

# Or download manually and place in ~/.cache/huggingface/
```

### 8.8 Virtual Environment Issues

```
Error: No module named 'django'
```

**Solutions**:
```bash
# Ensure virtual environment is activated
which python
# Should point to: .../venv/bin/python

# If not activated:
source venv/bin/activate

# Reinstall requirements
pip install -r requirements.txt
```

### 8.9 Angular Build Issues

```
Error: node_modules/@angular/material/...
```

**Solutions**:
```bash
# Clean install
rm -rf node_modules package-lock.json
npm cache clean --force
npm install

# Check Node.js version matches requirements
node --version  # Should be 20+
```

---

## 9. Environment Variables Reference

### 9.1 Common .env Template

Each service needs a `.env` file. Below is a composite of all variables across services:

```bash
# ── Database ───────────────────────────────────────────
DB_NAME=jobportal_db
DB_USER=admin
DB_PASSWORD=job@123
DB_HOST=localhost
DB_PORT=5432

# ── Django ─────────────────────────────────────────────
DJANGO_SECRET_KEY=your-secret-key-here-change-in-production
DJANGO_DEBUG=True
DJANGO_ALLOWED_HOSTS=localhost,127.0.0.1

# ── JWT ────────────────────────────────────────────────
JWT_SECRET_KEY=your-jwt-secret-key-shared-across-services
JWT_ACCESS_TOKEN_LIFETIME=60  # minutes
JWT_REFRESH_TOKEN_LIFETIME=7  # days

# ── Redis ──────────────────────────────────────────────
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# ── Celery ─────────────────────────────────────────────
CELERY_BROKER_URL=redis://localhost:6379/0

# ── Kafka ──────────────────────────────────────────────
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# ── Email (Gmail SMTP) ─────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=your-email@gmail.com
EMAIL_HOST_PASSWORD=your-app-password

# ── File Storage ───────────────────────────────────────
# Set to 's3' for AWS S3, 'local' for local filesystem
STORAGE_BACKEND=local

# ── AWS S3 (if STORAGE_BACKEND=s3) ─────────────────────
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_STORAGE_BUCKET_NAME=job-buddy-resumes
AWS_S3_REGION_NAME=us-east-1

# ── AI Provider ────────────────────────────────────────
# Options: gemini, openai, openrouter, opencode
AI_PROVIDER=gemini

# ── Google Gemini ──────────────────────────────────────
GEMINI_API_KEY=your-gemini-api-key

# ── OpenAI / OpenRouter ────────────────────────────────
OPENAI_API_KEY=your-openai-api-key
OPENAI_API_BASE=https://api.openai.com/v1  # For OpenAI
# OPENAI_API_BASE=https://openrouter.ai/api/v1  # For OpenRouter
OPENAI_MODEL=gpt-4o-mini  # or gpt-4o, claude-3-sonnet, etc.

# ── Service URLs (for internal service-to-service calls)─
JOB_SERVICE_URL=http://localhost:8003/api/jobs
```

### 9.2 Environment Variables Per Service

| Service | Required Variables | Optional Variables |
|---------|-------------------|-------------------|
| Auth | DB, Django, JWT, Redis, Kafka, Email | Celery |
| Profile | DB, Django, JWT, Redis, Kafka | Storage, AWS, Celery |
| Job | DB, Django, JWT, Redis, Kafka | Celery |
| Application | DB, Django, JWT, Redis, Kafka, JOB_SERVICE_URL | Celery |
| Matching | DB, Django, JWT, Redis, Kafka, AI | Celery |
| Notification | DB, Django, JWT, Redis, Kafka, Email | Celery |
| Chat | DB, Django, JWT, Redis, Kafka | Celery |

---

## 10. Useful Commands

### 10.1 Database Commands

```bash
# Connect to database
psql -U admin -d jobportal_db

# List all schemas
\dn

# List tables in a schema
\dt auth_schema.*

# Describe a table
\d+ auth_schema.users

# Show migrations
cd backend/auth_service && python manage.py showmigrations

# Create migrations
python manage.py makemigrations

# Apply migrations
python manage.py migrate

# Rollback a migration
python manage.py migrate <app_name> <previous_migration>

# Reset a schema (WARNING: drops all tables)
psql -U admin -d jobportal_db -c "DROP SCHEMA auth_schema CASCADE;"
psql -U admin -d jobportal_db -f scripts/init_db.sql
python manage.py migrate

# Backup database
pg_dump -U admin -d jobportal_db > backup.sql

# Restore database
psql -U admin -d jobportal_db < backup.sql
```

### 10.2 Redis Commands

```bash
# Connect to Redis
redis-cli

# List all keys
KEYS *

# Get a value
GET <key>

# Delete a key
DEL <key>

# Delete keys by pattern
redis-cli --scan --pattern 'jobs:list:*' | xargs redis-cli DEL

# Check TTL
TTL <key>

# Monitor all commands
MONITOR

# Flush all (WARNING: clears all cache)
FLUSHALL
```

### 10.3 Kafka Commands

```bash
# List topics (requires Kafka binaries)
kafka-topics.sh --bootstrap-server localhost:9092 --list

# Create a topic
kafka-topics.sh --bootstrap-server localhost:9092 \
  --create --topic test-topic --partitions 1 --replication-factor 1

# Consume messages
kafka-console-consumer.sh --bootstrap-server localhost:9092 \
  --topic resume.uploaded --from-beginning

# Produce a test message
echo '{"event_type": "test"}' | \
  kafka-console-producer.sh --bootstrap-server localhost:9092 \
  --topic test-topic

# View consumer groups
kafka-consumer-groups.sh --bootstrap-server localhost:9092 --list

# View consumer group details
kafka-consumer-groups.sh --bootstrap-server localhost:9092 \
  --group matching-group --describe

# Using kcat (alternative CLI)
kcat -C -b localhost:9092 -t resume.uploaded
kcat -P -b localhost:9092 -t test-topic
```

### 10.4 Docker Commands

```bash
# Start infrastructure
docker-compose up -d

# Stop infrastructure
docker-compose down

# Restart a specific service
docker-compose restart kafka

# View logs
docker-compose logs -f redis

# Rebuild containers
docker-compose up -d --build

# Check resource usage
docker stats

# Execute command in container
docker exec -it jobportal_redis redis-cli ping
```

### 10.5 Backend Management Commands

```bash
# Django shell (interactive Python)
cd backend/auth_service && python manage.py shell

# Create superuser
python manage.py createsuperuser

# Check for problems
python manage.py check

# Collect static files
python manage.py collectstatic

# Dump data (fixtures)
python manage.py dumpdata > data.json

# Load data (fixtures)
python manage.py loaddata data.json

# Test email configuration
python manage.py sendtestemail test@example.com

# List all URL patterns
python manage.py show_urls
```

### 10.6 Frontend Commands

```bash
# Start development server
ng serve

# Build for production
ng build --configuration production

# Run tests
ng test

# Run linting
ng lint

# Generate a new component
ng generate component features/my-feature/my-component

# Generate a new service
ng generate service core/services/my-service

# Analyze bundle size
ng build --stats-json
# Then analyze with webpack-bundle-analyzer
```

### 10.7 Git Commands

```bash
# Quick status check
git status
git diff --stat

# View log
git log --oneline -20 --graph

# Stash changes
git stash
git stash pop

# Undo local changes (WARNING: permanent)
git checkout -- <file>
git reset --hard HEAD
```

---

*This setup guide is part of the Job Buddy project. See [README.md](../README.md) for the full project overview.*
