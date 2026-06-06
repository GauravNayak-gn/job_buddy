from applications.services.kafka_client import KafkaProducerClient

def publish_application_stage_changed(application_id, seeker_id, new_stage):
    payload = {
        'application_id': str(application_id),
        'seeker_id': str(seeker_id),
        'new_stage': new_stage,
    }
    KafkaProducerClient.publish('application.stage_changed', payload)


def publish_interview_scheduled(application_id, seeker_id, scheduled_at, jitsi_link, seeker_email='', job_title=''):
    payload = {
        'application_id': str(application_id),
        'seeker_id': str(seeker_id),
        'seeker_email': seeker_email,
        'job_title': job_title,
        'scheduled_at': scheduled_at.isoformat() if hasattr(scheduled_at, 'isoformat') else str(scheduled_at),
        'jitsi_link': jitsi_link,
    }
    KafkaProducerClient.publish('interview.scheduled', payload)


def publish_application_received(application_id, recruiter_id, job_title='', seeker_email=''):
    payload = {
        'application_id': str(application_id),
        'recruiter_id': str(recruiter_id),
        'job_title': job_title,
        'seeker_email': seeker_email,
    }
    KafkaProducerClient.publish('application.received', payload)
