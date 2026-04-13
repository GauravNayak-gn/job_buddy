#!/bin/bash
# Backend Health Check Script

echo "================================================"
echo "  Job-Buddy Backend Health Check"
echo "================================================"

SERVICES=(
    "auth_service:8001:auth_schema"
    "profile_service:8002:profile_schema"
    "job_service:8003:job_schema"
    "application_service:8004:app_schema"
    "notification_service:8006:notification_schema"
    "chat_service:8005:chat_schema"
    "matching_service:8007:match_schema"
)

echo -e "\n[1] DATABASE CONNECTIVITY"
echo "================================================"

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service port schema <<< "$service_info"
    service_path="/media/gaurav/Local Disk/MWA/Job-buddy/backend/$service"
    
    if [ -d "$service_path" ]; then
        if [ -d "$service_path/venv" ]; then
            cd "$service_path"
            # Test DB connection and table count
            result=$(./venv/bin/python -c "
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', '${service}.settings')
import django
django.setup()
from django.db import connection
try:
    cursor = connection.cursor()
    cursor.execute('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s;', ('$schema',))
    count = cursor.fetchone()[0]
    print(f'✓ {count}' if count > 0 else '✗ 0')
except Exception as e:
    print(f'✗ ERROR')
" 2>/dev/null)
            echo "  $service → $result tables in $schema"
        else
            echo "  $service → ⚠ venv not found"
        fi
    else
        echo "  $service → ⚠ Service not found"
    fi
done

echo -e "\n[2] SERVICE PORTS & RUNNING STATUS"
echo "================================================"

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service port schema <<< "$service_info"
    
    if nc -z localhost $port 2>/dev/null; then
        echo "  Port $port ($service) → ✓ RUNNING"
    else
        echo "  Port $port ($service) → ✗ Not running"
    fi
done

echo -e "\n[3] .ENV FILES CHECK"
echo "================================================"

for service_info in "${SERVICES[@]}"; do
    IFS=':' read -r service port schema <<< "$service_info"
    service_path="/media/gaurav/Local Disk/MWA/Job-buddy/backend/$service"
    
    if [ -f "$service_path/.env" ]; then
        echo "  $service → ✓ .env exists"
    else
        echo "  $service → ✗ .env missing"
    fi
done

echo -e "\n[4] REDIS & KAFKA CONNECTIVITY"
echo "================================================"

# Check Redis
if nc -z localhost 6379 2>/dev/null; then
    echo "  Redis (6379) → ✓ Running"
else
    echo "  Redis (6379) → ✗ Not running"
fi

# Check Kafka
if nc -z localhost 9092 2>/dev/null; then
    echo "  Kafka (9092) → ✓ Running"
else
    echo "  Kafka (9092) → ✗ Not running"
fi

# Check PostgreSQL
if nc -z localhost 5432 2>/dev/null; then
    echo "  PostgreSQL (5432) → ✓ Running"
else
    echo "  PostgreSQL (5432) → ✗ Not running"
fi

echo -e "\n[5] NEXT STEPS"
echo "================================================"
echo "To start all services:"
echo ""
echo "  # Terminal 1 - Start servers individually:"
echo "  for svc in auth_service profile_service job_service application_service notification_service chat_service matching_service; do"
echo "    (cd backend/\$svc && source venv/bin/activate && python manage.py runserver 0.0.0.0:PORT &)"
echo "  done"
echo ""
echo "  OR run from docker-compose (if using containers)"
echo ""
echo "To test individual service endpoints:"
echo "  curl http://localhost:8001/api/health  # auth_service"
echo "  curl http://localhost:8002/api/health  # profile_service"
echo ""
echo "To see frontend:"
echo "  cd frontend && ng serve  # Then open http://localhost:4200"

