from celery import shared_task
import logging

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=5, default_retry_delay=60)
def publish_event_fallback_task(self, topic, payload):
    """
    Celery task that acts as a fallback to publish events to Kafka when it is down.
    It retries with exponential backoff / standard retry delay.
    """
    from jobs.services.kafka_client import KafkaProducerClient
    
    producer = KafkaProducerClient.get_producer()
    if producer is None:
        logger.warning("Celery fallback: Kafka is still down. Retrying task for topic: %s", topic)
        raise self.retry(exc=RuntimeError("Kafka broker not available"))
    try:
        future = producer.send(topic, payload)
        future.get(timeout=5)
        logger.info("Celery fallback: Successfully published message to Kafka topic: %s", topic)
    except Exception as e:
        logger.error("Celery fallback: Failed to publish message to Kafka topic: %s. Retrying.", topic, exc_info=True)
        raise self.retry(exc=e)
