import json
from django.conf import settings
from kafka import KafkaProducer

def _get_producer():
    return KafkaProducer(
        bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
        value_serializer=lambda v: json.dumps(v).encode('utf-8')
    )

def publish_application_stage_changed(application_id, seeker_id, new_stage):
    try:
        producer = _get_producer()
        producer.send('application.stage_changed', {
            'application_id': str(application_id),
            'seeker_id': str(seeker_id),
            'new_stage': new_stage,
        })
        producer.flush()
    except Exception:
        pass


def publish_interview_scheduled(application_id, seeker_id, scheduled_at, jitsi_link, seeker_email='', job_title=''):
    try:
        producer = _get_producer()
        producer.send('interview.scheduled', {
            'application_id': str(application_id),
            'seeker_id': str(seeker_id),
            'seeker_email': seeker_email,
            'job_title': job_title,
            'scheduled_at': scheduled_at.isoformat(),
            'jitsi_link': jitsi_link,
        })
        producer.flush()
    except Exception:
        pass


def publish_application_received(application_id, recruiter_id, job_title='', seeker_email=''):
    try:
        producer = _get_producer()
        event_data = {
            'application_id': str(application_id),
            'recruiter_id': str(recruiter_id),
            'job_title': job_title,
            'seeker_email': seeker_email,
        }
        producer.send('application.received', event_data)
        producer.flush()
        print(f"Published application.received event: {event_data}")
    except Exception as e:
        print(f"Failed to publish application.received event: {e}")
