from decouple import config

SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DJANGO_DEBUG', cast=bool)
ALLOWED_HOSTS = ['*']

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'rest_framework',
    'corsheaders',
    'jobs',
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
]

ROOT_URLCONF = 'job_service.urls'

TEMPLATES = [{
    'BACKEND': 'django.template.backends.django.DjangoTemplates',
    'DIRS': [],
    'APP_DIRS': True,
    'OPTIONS': {'context_processors': [
        'django.template.context_processors.request',
        'django.contrib.auth.context_processors.auth',
        'django.contrib.messages.context_processors.messages',
    ]},
}]

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('DB_NAME'),
        'USER': config('DB_USER'),
        'PASSWORD': config('DB_PASSWORD'),
        'HOST': config('DB_HOST'),
        'PORT': config('DB_PORT'),
        'OPTIONS': {'options': f"-c search_path={config('DB_SCHEMA')}"},
    }
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': config('REDIS_URL'),
        'OPTIONS': {
            'CLIENT_CLASS': 'django_redis.client.DefaultClient',
            "SERIALIZER": "django_redis.serializers.json.JSONSerializer",
        },
    }
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'job_service.authentication.JWTAuthentication',
    ),
    'DEFAULT_THROTTLE_CLASSES': (
        'job_service.throttling.RoleBasedUserRateThrottle',
    ),
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/day',
        'role_seeker': '1000/day',
        'role_recruiter': '5000/day',
        'role_admin': '10000/day',
    }
}

CORS_ALLOW_ALL_ORIGINS = True
STATIC_URL = '/static/'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

KAFKA_BOOTSTRAP_SERVERS = config('KAFKA_BOOTSTRAP_SERVERS', default='localhost:9092')

# Celery settings
CELERY_BROKER_URL = config('REDIS_URL', default='redis://127.0.0.1:6379/0')
CELERY_RESULT_BACKEND = config('REDIS_URL', default='redis://127.0.0.1:6379/0')
CELERY_ACCEPT_CONTENT = ['json']
CELERY_TASK_SERIALIZER = 'json'

