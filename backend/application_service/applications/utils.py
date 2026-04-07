import json
from django.conf import settings
from kafka import KafkaProducer


def publish_application_stage_changed(application_id, seeker_id, new_stage):
    try:
        producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        producer.send('application.stage_changed', {
            'application_id': str(application_id),
            'seeker_id': str(seeker_id),
            'new_stage': new_stage,
        })
        producer.flush()
    except Exception:
        pass


def publish_interview_scheduled(application_id, seeker_id, scheduled_at, jitsi_link):
    try:
        producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        producer.send('interview.scheduled', {
            'application_id': str(application_id),
            'seeker_id': str(seeker_id),
            'scheduled_at': scheduled_at.isoformat(),
            'jitsi_link': jitsi_link,
        })
        producer.flush()
    except Exception:
        pass
