import os
from celery import Celery

# Set default Django settings module for 'celery'
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_service.settings')

app = Celery('chat_service')

# Load settings from settings.py using CELERY_ namespace
app.config_from_object('django.conf:settings', namespace='CELERY')

# Load tasks from all registered apps (e.g. chat)
app.autodiscover_tasks()
