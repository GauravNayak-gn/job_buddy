#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

declare -a SERVICES=(
  "auth_service:8001"
  "profile_service:8002"
  "job_service:8003"
  "application_service:8004"
  "chat_service:8005"
  "notification_service:8006"
  "matching_service:8007"
)

echo "Starting Job Buddy backend services..."

for entry in "${SERVICES[@]}"; do
  IFS=":" read -r service port <<< "$entry"
  service_dir="$ROOT_DIR/backend/$service"
  pid_file="/tmp/jobbuddy_${service}.pid"
  log_file="/tmp/jobbuddy_${service}.log"

  if [[ ! -d "$service_dir" ]]; then
    echo " - $service: directory not found, skipping"
    continue
  fi

  if [[ -f "$pid_file" ]] && kill -0 "$(cat "$pid_file")" 2>/dev/null; then
    echo " - $service already running (pid $(cat "$pid_file"))"
    continue
  fi

  if [[ -x "$service_dir/venv/bin/python" ]]; then
    cmd="$service_dir/venv/bin/python"
  else
    cmd="python3"
  fi

  (
    cd "$service_dir"
    nohup "$cmd" manage.py runserver "0.0.0.0:${port}" >"$log_file" 2>&1 &
    echo $! > "$pid_file"
  )

  echo " - $service started on :$port (log: $log_file)"
done

echo ""
echo "Done. Verify with:"
echo "  bash health_check.sh"
echo "or:"
echo "  curl http://127.0.0.1:80/api/auth/health/"
