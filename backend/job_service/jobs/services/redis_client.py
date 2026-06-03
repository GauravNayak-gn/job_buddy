import logging
from django.core.cache import cache

logger = logging.getLogger(__name__)

class RedisClient:
    """
    Centralized Redis client wrapper for job_service.
    Ensures connection failures are logged and do not crash requests.
    """
    @staticmethod
    def get(key, default=None):
        try:
            return cache.get(key, default=default)
        except Exception as e:
            logger.error("Redis get failed for key: %s, error: %s", key, e, exc_info=True)
            return default

    @staticmethod
    def set(key, value, timeout=300):
        try:
            cache.set(key, value, timeout=timeout)
            return True
        except Exception as e:
            logger.error("Redis set failed for key: %s, error: %s", key, e, exc_info=True)
            return False

    @staticmethod
    def delete(key):
        try:
            cache.delete(key)
            return True
        except Exception as e:
            logger.error("Redis delete failed for key: %s, error: %s", key, e, exc_info=True)
            return False

    @staticmethod
    def delete_pattern(pattern):
        try:
            if hasattr(cache, 'delete_pattern'):
                cache.delete_pattern(pattern)
            elif hasattr(cache, 'keys'):
                keys = cache.keys(pattern)
                if keys:
                    cache.delete_many(keys)
            return True
        except Exception as e:
            logger.error("Redis delete_pattern failed for pattern: %s, error: %s", pattern, e, exc_info=True)
            return False
