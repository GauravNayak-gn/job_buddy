#!/usr/bin/env python3
"""
Diagnostic script to check database connectivity for all backend services
"""
import os
import sys
import psycopg2
from psycopg2 import sql
from pathlib import Path
import subprocess

# Database connection details
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'jobportal_db',
    'user': 'admin',
    'password': 'job@123',
}

SERVICES = [
    'auth_service',
    'profile_service',
    'job_service',
    'application_service',
    'notification_service',
    'chat_service',
    'matching_service',
]

SCHEMAS = {
    'auth_service': 'auth_schema',
    'profile_service': 'profile_schema',
    'job_service': 'job_schema',
    'application_service': 'app_schema',
    'notification_service': 'notification_schema',
    'chat_service': 'chat_schema',
    'matching_service': 'match_schema',
}

def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}")

def check_postgres_connection():
    """Check if PostgreSQL is running and accessible"""
    print_section("1. PostgreSQL Connection Check")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        print(f"✓ Connected to PostgreSQL")
        print(f"  Version: {version.split(',')[0]}")
        cursor.close()
        conn.close()
        return True
    except Exception as e:
        print(f"✗ Failed to connect to PostgreSQL")
        print(f"  Error: {e}")
        return False

def check_schemas():
    """Check if all schemas exist"""
    print_section("2. Schema Verification")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT schema_name FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'public');
        """)
        existing_schemas = {row[0] for row in cursor.fetchall()}
        cursor.close()
        conn.close()
        
        all_good = True
        for service, schema in SCHEMAS.items():
            if schema in existing_schemas:
                print(f"✓ {service:25} → {schema}")
            else:
                print(f"✗ {service:25} → {schema} (NOT FOUND)")
                all_good = False
        return all_good
    except Exception as e:
        print(f"✗ Error checking schemas: {e}")
        return False

def check_migrations():
    """Check if migrations have been applied for each service"""
    print_section("3. Django Migrations Status")
    backend_path = Path(__file__).parent / 'backend'
    
    for service in SERVICES:
        service_path = backend_path / service
        if not service_path.exists():
            print(f"✗ {service:25} → Service directory not found")
            continue
        
        # Check if migrations have been applied
        manage_py = service_path / 'manage.py'
        if manage_py.exists():
            try:
                result = subprocess.run(
                    ['python', str(manage_py), 'showmigrations', '--list'],
                    cwd=str(service_path),
                    capture_output=True,
                    text=True,
                    timeout=10
                )
                # Check if there are any unapplied migrations (lines not starting with [X])
                lines = result.stdout.split('\n')
                has_unapplied = any(line.strip().startswith('[ ]') for line in lines if line.strip())
                
                if has_unapplied:
                    print(f"✗ {service:25} → Has unapplied migrations")
                else:
                    print(f"✓ {service:25} → All migrations applied")
            except subprocess.TimeoutExpired:
                print(f"✗ {service:25} → Timeout checking migrations")
            except Exception as e:
                print(f"✗ {service:25} → Error: {str(e)[:40]}")
        else:
            print(f"✗ {service:25} → manage.py not found")

def check_env_files():
    """Check if .env files exist for each service"""
    print_section("4. Environment Files Check")
    backend_path = Path(__file__).parent / 'backend'
    
    for service in SERVICES:
        service_path = backend_path / service
        env_file = service_path / '.env'
        
        if env_file.exists():
            print(f"✓ {service:25} → .env file exists")
        else:
            print(f"✗ {service:25} → .env file NOT found (copy from .env.example)")

def check_table_count():
    """Check if tables exist in each schema"""
    print_section("5. Database Tables in Schemas")
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        for service, schema in SCHEMAS.items():
            cursor.execute(f"""
                SELECT COUNT(*) FROM information_schema.tables 
                WHERE table_schema = %s AND table_type = 'BASE TABLE';
            """, (schema,))
            table_count = cursor.fetchone()[0]
            
            if table_count > 0:
                print(f"✓ {service:25} → {table_count} tables in {schema}")
            else:
                print(f"✗ {service:25} → No tables in {schema} (migrations not applied?)")
        
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"✗ Error checking tables: {e}")

def main():
    print_section("Job-Buddy Backend Database Connectivity Check")
    
    # Run checks
    postgres_ok = check_postgres_connection()
    if not postgres_ok:
        print("\n✗ Cannot proceed without PostgreSQL connection")
        sys.exit(1)
    
    check_schemas()
    check_env_files()
    check_table_count()
    check_migrations()
    
    print_section("Summary")
    print("\nTo fix issues:")
    print("1. Ensure PostgreSQL is running: sudo systemctl status postgresql")
    print("2. Copy .env files:  cp backend/*/. env.example backend/*/.env")
    print("3. Apply migrations:  cd backend/<service> && python manage.py migrate")
    print("4. Start services:    python manage.py runserver 0.0.0.0:PORT")
    print("5. Check health:      curl http://localhost:PORT/api/health")

if __name__ == '__main__':
    main()
