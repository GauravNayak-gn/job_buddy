import json
from urllib.error import HTTPError, URLError
from urllib.request import urlopen
from django.conf import settings

def fetch_job_details(job_id):
    url = f"{settings.JOB_SERVICE_URL}/{job_id}/"
    try:
        with urlopen(url, timeout=5) as response:
            payload = json.loads(response.read().decode('utf-8'))
            return payload if isinstance(payload, dict) else None
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
