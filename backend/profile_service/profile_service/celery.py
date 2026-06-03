import os
from celery import Celery

# Set default Django settings module for 'celery'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'profile_service.settings')

app = Celery('profile_service')

# Load settings from settings.py using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load tasks from all registered apps (e.g. profiles)
app.autodiscover_tasks()
