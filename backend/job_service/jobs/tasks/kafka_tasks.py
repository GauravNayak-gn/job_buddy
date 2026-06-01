import json
from django.conf import settings
from kafka import KafkaProducer

def publish_job_published_event(job_id, description):
    try:
        producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        producer.send('job.published', {'job_id': str(job_id), 'description_text': description})
        producer.flush()
    except Exception:
        pass
