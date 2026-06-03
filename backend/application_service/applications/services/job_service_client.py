import json
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from django.conf import settings
from applications.services.redis_client import RedisClient

def fetch_job_details(job_id):
    cache_key = f"cached_job_details_{job_id}"
    
    # Try reading from Redis first
    cached_details = RedisClient.get(cache_key)
    if cached_details is not None:
        return cached_details

    url = f"{settings.JOB_SERVICE_URL}/{job_id}/"
    try:
        with urlopen(url, timeout=5) as response:
            payload = json.loads(response.read().decode('utf-8'))
            details = payload if isinstance(payload, dict) else None
            if details:
                # Cache job details in Redis for 5 minutes
                RedisClient.set(cache_key, details, timeout=300)
            return details
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
