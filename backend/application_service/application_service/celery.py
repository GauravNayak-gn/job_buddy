import os
from celery import Celery

# Set default Django settings module for 'celery'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'application_service.settings')

app = Celery('application_service')

# Load settings from settings.py using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load tasks from all registered apps (e.g. applications)
app.autodiscover_tasks()
