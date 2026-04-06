# Setup Guide — Running Everything on Your Machine

## What You Will Have Running

After this guide, your machine will run:
- PostgreSQL with pgvector
- Redis
- Kafka + Zookeeper
- All 7 Django services
- Nginx as reverse proxy
- Angular frontend

Everything runs via Docker Compose. You only need Docker installed.

---

## Prerequisites

### Install Docker on Linux
```bash
sudo apt update
sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER
# Log out and log back in after this
```

### Verify
```bash
docker --version
docker compose version
```

### Install Node.js (for Angular)
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node --version   # should be 20.x
npm --version
```

### Install Angular CLI
```bash
npm install -g @angular/cli
ng version
```

### Install Python (for running services without Docker if needed)
```bash
sudo apt install -y python3.11 python3.11-venv python3-pip
```

---

## Step 1 — Create Project Folder Structure

```bash
mkdir -p job-portal/services
mkdir -p job-portal/nginx
mkdir -p job-portal/docs
cd job-portal
```

---

## Step 2 — Docker Compose File

Create `job-portal/docker-compose.yml`:

```yaml
version: '3.9'

services:

  # ─── Infrastructure ───────────────────────────────────────

  postgres:
    image: pgvector/pgvector:pg16
    container_name: jobportal_postgres
    environment:
      POSTGRES_DB: jobportal_db
      POSTGRES_USER: jobportal_user
      POSTGRES_PASSWORD: jobportal_pass
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./scripts/init_db.sql:/docker-entrypoint-initdb.d/init_db.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U jobportal_user -d jobportal_db"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: jobportal_redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    container_name: jobportal_zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    container_name: jobportal_kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://kafka:29092,PLAINTEXT_HOST://localhost:9092
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: "true"

  # ─── Backend Services ──────────────────────────────────────

  auth_service:
    build: ./services/auth_service
    container_name: jobportal_auth
    env_file: ./services/auth_service/.env
    ports:
      - "8001:8001"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: python manage.py runserver 0.0.0.0:8001

  profile_service:
    build: ./services/profile_service
    container_name: jobportal_profile
    env_file: ./services/profile_service/.env
    ports:
      - "8002:8002"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    command: python manage.py runserver 0.0.0.0:8002

  job_service:
    build: ./services/job_service
    container_name: jobportal_job
    env_file: ./services/job_service/.env
    ports:
      - "8003:8003"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    command: python manage.py runserver 0.0.0.0:8003

  application_service:
    build: ./services/application_service
    container_name: jobportal_application
    env_file: ./services/application_service/.env
    ports:
      - "8004:8004"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    command: python manage.py runserver 0.0.0.0:8004

  matching_service:
    build: ./services/matching_service
    container_name: jobportal_matching
    env_file: ./services/matching_service/.env
    ports:
      - "8005:8005"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    command: python manage.py runserver 0.0.0.0:8005

  notification_service:
    build: ./services/notification_service
    container_name: jobportal_notification
    env_file: ./services/notification_service/.env
    ports:
      - "8006:8006"
    depends_on:
      postgres:
        condition: service_healthy
      kafka:
        condition: service_started
    command: python manage.py runserver 0.0.0.0:8006

  chat_service:
    build: ./services/chat_service
    container_name: jobportal_chat
    env_file: ./services/chat_service/.env
    ports:
      - "8007:8007"
    depends_on:
      postgres:
        condition: service_healthy
    command: python manage.py runserver 0.0.0.0:8007

  # ─── Nginx ────────────────────────────────────────────────

  nginx:
    image: nginx:alpine
    container_name: jobportal_nginx
    ports:
      - "80:80"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - auth_service
      - profile_service
      - job_service
      - application_service
      - matching_service
      - notification_service

volumes:
  postgres_data:
```

---

## Step 3 — Database Initialization Script

Create `job-portal/scripts/init_db.sql`:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create all schemas
CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS profile_schema;
CREATE SCHEMA IF NOT EXISTS job_schema;
CREATE SCHEMA IF NOT EXISTS app_schema;
CREATE SCHEMA IF NOT EXISTS match_schema;
CREATE SCHEMA IF NOT EXISTS notification_schema;
CREATE SCHEMA IF NOT EXISTS chat_schema;

-- Grant permissions to our user
GRANT ALL ON SCHEMA auth_schema TO jobportal_user;
GRANT ALL ON SCHEMA profile_schema TO jobportal_user;
GRANT ALL ON SCHEMA job_schema TO jobportal_user;
GRANT ALL ON SCHEMA app_schema TO jobportal_user;
GRANT ALL ON SCHEMA match_schema TO jobportal_user;
GRANT ALL ON SCHEMA notification_schema TO jobportal_user;
GRANT ALL ON SCHEMA chat_schema TO jobportal_user;
```

---

## Step 4 — Nginx Config

Create `job-portal/nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream auth_service      { server auth_service:8001; }
    upstream profile_service   { server profile_service:8002; }
    upstream job_service       { server job_service:8003; }
    upstream application_service { server application_service:8004; }
    upstream matching_service  { server matching_service:8005; }
    upstream notification_service { server notification_service:8006; }
    upstream chat_service      { server chat_service:8007; }

    server {
        listen 80;

        location /api/auth/        { proxy_pass http://auth_service; }
        location /api/profile/     { proxy_pass http://profile_service; }
        location /api/jobs/        { proxy_pass http://job_service; }
        location /api/applications/{ proxy_pass http://application_service; }
        location /api/match/       { proxy_pass http://matching_service; }
        location /api/notifications/{ proxy_pass http://notification_service; }
        location /api/chat/        { proxy_pass http://chat_service; }

        # Proxy headers for all locations
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

---

## Step 5 — Django Service Template

Every service follows this same pattern. Here is the template for **auth_service** — repeat for others changing the schema name and apps.

### Folder structure for one service
```
services/auth_service/
├── Dockerfile
├── requirements.txt
├── .env
├── manage.py
└── auth_service/
    ├── settings.py
    ├── urls.py
    └── wsgi.py
```

### Dockerfile (same for all services)
```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y libpq-dev gcc && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8001
```

### requirements.txt (auth_service)
```
django==4.2
djangorestframework==3.15
djangorestframework-simplejwt==5.3
psycopg2-binary==2.9
django-redis==5.4
redis==5.0
kafka-python==2.0
python-decouple==3.8
django-cors-headers==4.3
```

### .env (auth_service)
```env
SECRET_KEY=your-secret-key-change-this-in-production
DEBUG=True
DB_NAME=jobportal_db
DB_USER=jobportal_user
DB_PASSWORD=jobportal_pass
DB_HOST=postgres
DB_PORT=5432
DB_SCHEMA=auth_schema
REDIS_URL=redis://redis:6379/0
KAFKA_BOOTSTRAP_SERVERS=kafka:29092
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=yourproject@gmail.com
EMAIL_HOST_PASSWORD=your-gmail-app-password
```

### settings.py (auth_service)
```python
from decouple import config

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', cast=bool)
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'accounts',  # your app name
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT'),
        'OPTIONS': {
            'options': f"-c search_path={config('DB_SCHEMA')}"
        },
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL'),
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
}

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = config('EMAIL_HOST')
EMAIL_PORT = config('EMAIL_PORT', cast=int)
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD')
DEFAULT_FROM_EMAIL = f"Job Portal <{config('EMAIL_HOST_USER')}>"

CORS_ALLOW_ALL_ORIGINS = True  # restrict in production

STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
```

---

## Step 6 — Gmail App Password Setup (Avoid Spam)

1. Go to your Google Account → Security
2. Enable 2-Step Verification (required)
3. Go to Security → App Passwords
4. Select app: Mail, device: Other → type "Job Portal"
5. Copy the 16-character password
6. Put it in `.env` as `EMAIL_HOST_PASSWORD`

This is different from your Gmail password. Emails sent this way are authenticated and won't go to spam for normal transactional emails.

---

## Step 7 — Create the Kafka Topics

After starting Docker Compose, create topics manually:

```bash
# Wait for Kafka to start, then run:
docker exec jobportal_kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic user.registered \
  --partitions 1 --replication-factor 1

docker exec jobportal_kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic resume.uploaded \
  --partitions 1 --replication-factor 1

docker exec jobportal_kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic job.published \
  --partitions 1 --replication-factor 1

docker exec jobportal_kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic application.stage_changed \
  --partitions 1 --replication-factor 1

docker exec jobportal_kafka kafka-topics --create \
  --bootstrap-server localhost:9092 \
  --topic interview.scheduled \
  --partitions 1 --replication-factor 1

# Verify topics exist
docker exec jobportal_kafka kafka-topics --list --bootstrap-server localhost:9092
```

---

## Step 8 — Run Migrations for Each Service

```bash
# Run inside each service container
docker exec jobportal_auth python manage.py migrate
docker exec jobportal_profile python manage.py migrate
docker exec jobportal_job python manage.py migrate
docker exec jobportal_application python manage.py migrate
docker exec jobportal_matching python manage.py migrate
docker exec jobportal_notification python manage.py migrate
docker exec jobportal_chat python manage.py migrate
```

---

## Step 9 — Load Sample Data

Create `job-portal/scripts/sample_data.sql` and run it:

```sql
-- Switch to auth_schema
SET search_path = auth_schema;

INSERT INTO users (id, email, password_hash, role, is_active, is_verified) VALUES
('a1b2c3d4-0000-0000-0000-000000000001', 'rahul@gmail.com',    'hashed_pw_here', 'seeker',    true, true),
('a1b2c3d4-0000-0000-0000-000000000002', 'priya@techcorp.com', 'hashed_pw_here', 'recruiter', true, true),
('a1b2c3d4-0000-0000-0000-000000000003', 'admin@portal.com',   'hashed_pw_here', 'admin',     true, true);

-- Switch to profile_schema
SET search_path = profile_schema;

INSERT INTO seeker_profiles (id, user_id, first_name, last_name, current_title, summary) VALUES
('b1b2c3d4-0000-0000-0000-000000000001',
 'a1b2c3d4-0000-0000-0000-000000000001',
 'Rahul', 'Sharma', 'Full Stack Developer',
 '2 years of experience in Django and Angular. Passionate about building scalable web apps.');

INSERT INTO recruiter_profiles (id, user_id, company_name, industry, hq_location, company_size) VALUES
('c1b2c3d4-0000-0000-0000-000000000001',
 'a1b2c3d4-0000-0000-0000-000000000002',
 'TechCorp India', 'Software', 'Bangalore', '51-200');

INSERT INTO skills (id, name) VALUES
('s0000001-0000-0000-0000-000000000001', 'Python'),
('s0000001-0000-0000-0000-000000000002', 'Django'),
('s0000001-0000-0000-0000-000000000003', 'Angular'),
('s0000001-0000-0000-0000-000000000004', 'PostgreSQL'),
('s0000001-0000-0000-0000-000000000005', 'React'),
('s0000001-0000-0000-0000-000000000006', 'Docker');

INSERT INTO seeker_skills (id, seeker_id, skill_id, years_of_experience) VALUES
('sk000001-0000-0000-0000-000000000001', 'b1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000001', 2),
('sk000001-0000-0000-0000-000000000002', 'b1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000002', 2),
('sk000001-0000-0000-0000-000000000003', 'b1b2c3d4-0000-0000-0000-000000000001', 's0000001-0000-0000-0000-000000000003', 1);

-- Switch to job_schema
SET search_path = job_schema;

INSERT INTO job_categories (id, name) VALUES
('cat00001-0000-0000-0000-000000000001', 'Software Engineering'),
('cat00001-0000-0000-0000-000000000002', 'Data Science'),
('cat00001-0000-0000-0000-000000000003', 'DevOps');

INSERT INTO jobs (id, recruiter_id, category_id, title, slug, description, location_type, salary_min, salary_max, experience_required, status) VALUES
('job00001-0000-0000-0000-000000000001',
 'c1b2c3d4-0000-0000-0000-000000000001',
 'cat00001-0000-0000-0000-000000000001',
 'Backend Developer - Django',
 'backend-developer-django-techcorp',
 'We are looking for a Django developer with experience in REST APIs, PostgreSQL, and Docker. You will build and maintain our core platform services.',
 'remote', 40000, 70000, '1-3 years', 'published');

-- Switch to app_schema
SET search_path = app_schema;

INSERT INTO applications (id, job_id, seeker_id, resume_id, cover_letter, current_stage) VALUES
('app00001-0000-0000-0000-000000000001',
 'job00001-0000-0000-0000-000000000001',
 'b1b2c3d4-0000-0000-0000-000000000001',
 'res00001-0000-0000-0000-000000000001',
 'I am very interested in this role and believe my Django experience makes me a strong fit.',
 'applied');
```

Run it:
```bash
docker exec -i jobportal_postgres psql -U jobportal_user -d jobportal_db < scripts/sample_data.sql
```

---

## Step 10 — Start Everything

```bash
cd job-portal

# Start all infrastructure and services
docker compose up -d

# Check all containers are running
docker compose ps

# View logs for a specific service
docker compose logs -f auth_service

# View logs for all services
docker compose logs -f
```

---

## Step 11 — Angular Frontend Setup

```bash
cd job-portal
ng new frontend --routing --style=scss
cd frontend
npm install

# Install HTTP client and JWT helper
npm install @auth0/angular-jwt

# Start dev server
ng serve --port 4200
```

Angular will run on `http://localhost:4200` and call `http://localhost/api/...` through Nginx.

In `frontend/src/environments/environment.ts`:
```typescript
export const environment = {
  production: false,
  apiUrl: 'http://localhost/api'
};
```

---

## Step 12 — Verify Everything is Working

```bash
# Test Auth Service
curl http://localhost/api/auth/health/
# Expected: {"status": "ok", "service": "auth"}

# Test Job Service
curl http://localhost/api/jobs/
# Expected: list of jobs

# Check PostgreSQL schemas exist
docker exec jobportal_postgres psql -U jobportal_user -d jobportal_db \
  -c "\dn"
# Should show: auth_schema, profile_schema, job_schema, app_schema, match_schema, notification_schema, chat_schema

# Check pgvector is installed
docker exec jobportal_postgres psql -U jobportal_user -d jobportal_db \
  -c "SELECT * FROM pg_extension WHERE extname = 'vector';"
```

---

## Useful Commands Reference

```bash
# Stop everything
docker compose down

# Stop and delete all data (fresh start)
docker compose down -v

# Rebuild a specific service after code change
docker compose up -d --build auth_service

# Open a shell inside a service
docker exec -it jobportal_auth bash

# Open PostgreSQL shell
docker exec -it jobportal_postgres psql -U jobportal_user -d jobportal_db

# Check Kafka topics
docker exec jobportal_kafka kafka-topics --list --bootstrap-server localhost:9092

# Monitor Kafka messages on a topic
docker exec jobportal_kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic application.stage_changed \
  --from-beginning
```

---

## Without Docker (If Needed)

If Docker is not available, run each service manually:

```bash
# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install pgvector
sudo apt install -y postgresql-16-pgvector

# Install Redis
sudo apt install -y redis-server

# Install Kafka (download from kafka.apache.org)
# Or use a simpler alternative: run Kafka via the binary

# For each service:
cd services/auth_service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 8001
```

Run each service in a separate terminal tab.

---

## Development Order Recommendation

Build in this order to avoid blockers:

1. Set up Docker Compose + PostgreSQL + Redis + Kafka (infrastructure first)
2. Auth Service (everything depends on JWT from here)
3. Profile Service (seekers and recruiters need profiles)
4. Job Service (jobs need recruiter profiles)
5. Application Service (applications need jobs and profiles)
6. Notification Service (needs Kafka events from Application Service)
7. Matching Service (needs resumes and jobs to exist)
8. Chat Service (placeholder, add last)
9. Angular Frontend (build pages as each backend service is ready)

---

## Sentence Transformers Setup (Matching Service)

The AI model downloads automatically on first run. Add to matching_service requirements.txt:

```
sentence-transformers==2.7.0
torch==2.2.0
```

In your matching service code:
```python
from sentence_transformers import SentenceTransformer

# This downloads the model once (~80MB), then uses local cache
model = SentenceTransformer('all-MiniLM-L6-v2')

def get_embedding(text: str) -> list:
    return model.encode(text).tolist()
```

The model is cached at `~/.cache/huggingface/` after first download. No internet needed after that.

---

## Ports Summary

| Service | Port | URL |
|---|---|---|
| Nginx (entry point) | 80 | http://localhost |
| Auth Service | 8001 | http://localhost/api/auth/ |
| Profile Service | 8002 | http://localhost/api/profile/ |
| Job Service | 8003 | http://localhost/api/jobs/ |
| Application Service | 8004 | http://localhost/api/applications/ |
| Matching Service | 8005 | http://localhost/api/match/ |
| Notification Service | 8006 | http://localhost/api/notifications/ |
| Chat Service | 8007 | http://localhost/api/chat/ |
| PostgreSQL | 5432 | internal |
| Redis | 6379 | internal |
| Kafka | 9092 | internal |
| Angular Dev Server | 4200 | http://localhost:4200 |
