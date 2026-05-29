import os
import django
import sys

# Add both service directories to path
sys.path.append(os.path.abspath("../job_service"))
sys.path.append(os.path.abspath("."))

# Setup Job Service to read jobs
os.environ["DJANGO_SETTINGS_MODULE"] = "job_service.settings"
django.setup()
from jobs.models import Job

# Setup Matching Service to save embeddings
os.environ["DJANGO_SETTINGS_MODULE"] = "matching_service.settings"
# Re-setup for different settings
from django.conf import settings
import django.apps
django.apps.apps.app_configs = {}
django.setup()

from matching.models import JobEmbedding
from matching.utils import generate_embedding

def sync():
    jobs = Job.objects.all()
    count = 0
    for job in jobs:
        emb, created = JobEmbedding.objects.get_or_create(
            job_id=job.id,
            defaults={'embedding': generate_embedding(job.description)}
        )
        if created:
            count += 1
    print(f"Successfully synced {count} new embeddings. Total: {JobEmbedding.objects.count()}")

if __name__ == "__main__":
    sync()
