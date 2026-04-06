-- Run this once on your local PostgreSQL to set up all schemas
-- Command: psql -U postgres -d jobportal_db -f scripts/init_db.sql

CREATE EXTENSION IF NOT EXISTS vector;

CREATE SCHEMA IF NOT EXISTS auth_schema;
CREATE SCHEMA IF NOT EXISTS profile_schema;
CREATE SCHEMA IF NOT EXISTS job_schema;
CREATE SCHEMA IF NOT EXISTS app_schema;
CREATE SCHEMA IF NOT EXISTS match_schema;
CREATE SCHEMA IF NOT EXISTS notification_schema;
CREATE SCHEMA IF NOT EXISTS chat_schema;

GRANT ALL ON SCHEMA auth_schema TO admin;
GRANT ALL ON SCHEMA profile_schema TO admin;
GRANT ALL ON SCHEMA job_schema TO admin;
GRANT ALL ON SCHEMA app_schema TO admin;
GRANT ALL ON SCHEMA match_schema TO admin;
GRANT ALL ON SCHEMA notification_schema TO admin;
GRANT ALL ON SCHEMA chat_schema TO admin;
