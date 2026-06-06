import json
import logging
from django.conf import settings
from kafka import KafkaProducer

logger = logging.getLogger(__name__)

class KafkaProducerClient:
    _producer = None

    @classmethod
    def get_producer(cls):
        if cls._producer is None:
            bootstrap_servers = getattr(settings, 'KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
            try:
                cls._producer = KafkaProducer(
                    bootstrap_servers=bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                    connections_max_idle_ms=10000,
                    request_timeout_ms=5000,
                    retries=3,
                )
            except Exception as e:
                logger.error("Failed to initialize KafkaProducer: %s", e, exc_info=True)
                cls._producer = None
        return cls._producer

    @classmethod
    def publish(cls, topic, payload):
        producer = cls.get_producer()
        if producer is None:
            logger.warning("Kafka producer is not available. Falling back to Celery for topic: %s", topic)
            cls.fallback_to_celery(topic, payload)
            return False

        try:
            future = producer.send(topic, payload)
            future.get(timeout=5)
            logger.info("Successfully published message to Kafka topic: %s", topic)
            return True
        except Exception as e:
            logger.error("Failed to publish message to Kafka topic: %s. Falling back to Celery. Error: %s", topic, e, exc_info=True)
            cls.fallback_to_celery(topic, payload)
            cls._producer = None
            return False

    @classmethod
    def fallback_to_celery(cls, topic, payload):
        try:
            from chat.tasks.celery_tasks import publish_event_fallback_task
            publish_event_fallback_task.delay(topic, payload)
        except Exception as e:
            logger.error("Failed to trigger Celery fallback task for topic: %s, error: %s", topic, e, exc_info=True)
