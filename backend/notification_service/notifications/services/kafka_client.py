import json
import logging
import time
from django.conf import settings
from kafka import KafkaConsumer, KafkaProducer

logger = logging.getLogger(__name__)

class KafkaConsumerClient:
    _dlq_producer = None

    @classmethod
    def get_dlq_producer(cls):
        if cls._dlq_producer is None:
            bootstrap_servers = getattr(settings, 'KAFKA_BOOTSTRAP_SERVERS', 'localhost:9092')
            try:
                cls._dlq_producer = KafkaProducer(
                    bootstrap_servers=bootstrap_servers,
                    value_serializer=lambda v: json.dumps(v).encode('utf-8')
                )
            except Exception as e:
                logger.error("Failed to initialize DLQ KafkaProducer: %s", e, exc_info=True)
                cls._dlq_producer = None
        return cls._dlq_producer

    @classmethod
    def publish_to_dlq(cls, original_topic, payload, error_message):
        producer = cls.get_dlq_producer()
        dlq_topic = f"dlq.{original_topic}"
        dlq_payload = {
            'original_topic': original_topic,
            'payload': payload,
            'error': str(error_message),
            'failed_at': time.time()
        }
        if producer:
            try:
                producer.send(dlq_topic, dlq_payload)
                producer.flush()
                logger.warning("Message from topic %s sent to DLQ topic %s due to error: %s", original_topic, dlq_topic, error_message)
            except Exception as e:
                logger.error("Failed to send message to DLQ topic %s, error: %s", dlq_topic, e, exc_info=True)
        else:
            logger.error("DLQ Producer not available. Message lost: %s, error: %s", dlq_payload, error_message)

    @classmethod
    def process_message_with_retry(cls, message, handler_func, max_retries=3):
        topic = message.topic
        payload = message.value
        attempt = 0
        backoff = 2

        while attempt < max_retries:
            try:
                handler_func(topic, payload)
                return True
            except Exception as e:
                attempt += 1
                logger.error("Error processing message from topic %s (attempt %d/%d): %s", topic, attempt, max_retries, e, exc_info=True)
                if attempt < max_retries:
                    time.sleep(backoff)
                    backoff *= 2
                else:
                    cls.publish_to_dlq(topic, payload, e)
        return False
```
