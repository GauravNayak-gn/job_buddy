#!/usr/bin/env bash
set -euo pipefail

declare -a SERVICES=(
  "auth_service"
  "profile_service"
  "job_service"
  "application_service"
  "chat_service"
  "notification_service"
  "matching_service"
)

echo "Stopping Job Buddy backend services..."

for service in "${SERVICES[@]}"; do
  pid_file="/tmp/jobbuddy_${service}.pid"
  if [[ ! -f "$pid_file" ]]; then
    echo " - $service not running (no pid file)"
    continue
  fi

  pid="$(cat "$pid_file")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    echo " - stopped $service (pid $pid)"
  else
    echo " - $service not running (stale pid $pid)"
  fi
  rm -f "$pid_file"
done

echo "Done."
