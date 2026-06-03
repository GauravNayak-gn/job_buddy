import json
import logging
from kafka import KafkaConsumer
from django.conf import settings
from django.core.management.base import BaseCommand

from notifications.dao.notification_dao import NotificationDAO
from notifications.services.notification_service import NotificationService
from notifications.services.kafka_client import KafkaConsumerClient

logger = logging.getLogger(__name__)

TOPICS = [
    'application.stage_changed',
    'interview.scheduled',
    'user.registered',
    'application.received',
    'chat.message_sent'
]

def handle_notification_event(topic, payload):
    """
    Handle notification-specific Kafka events and persist in-app notifications
    (and send emails when necessary).
    """
    if topic == 'application.stage_changed':
        user_id = payload.get('seeker_id')
        if user_id:
            NotificationDAO.create_notification(
                user_id=user_id,
                notification_type=topic,
                title='Application stage updated',
                body=f"Your application moved to: {payload.get('new_stage', 'updated')}",
                payload=payload,
            )

    elif topic == 'interview.scheduled':
        user_id = payload.get('seeker_id')
        email = payload.get('seeker_email')
        scheduled_at = payload.get('scheduled_at', 'TBD')
        jitsi_link = payload.get('jitsi_link', '')
        job_title = payload.get('job_title') or 'your application'
        if user_id:
            NotificationDAO.create_notification(
                user_id=user_id,
                notification_type=topic,
                title='Interview scheduled',
                body=f"Interview scheduled for {job_title} at {scheduled_at}. Join here: {jitsi_link}",
                payload=payload,
            )
            # Try to send email but log failure rather than crashing consumer
            try:
                NotificationService.send_email(
                    to_email=email,
                    subject='Interview scheduled',
                    message=(
                        f"Your interview for {job_title} is scheduled at {scheduled_at}.\n"
                        f"Join link: {jitsi_link}"
                    ),
                )
            except Exception as e:
                logger.error("Failed to send interview email notification: %s", e, exc_info=True)

    elif topic == 'user.registered':
        user_id = payload.get('user_id')
        email = payload.get('email')
        if user_id:
            NotificationDAO.create_notification(
                user_id=user_id,
                notification_type=topic,
                title='Welcome to Job Buddy',
                body='Your account was created successfully.',
                payload=payload,
            )
            try:
                NotificationService.send_email(
                    to_email=email,
                    subject='Welcome to Job Buddy',
                    message='Your account was created successfully.',
                )
            except Exception as e:
                logger.error("Failed to send welcome email: %s", e, exc_info=True)

    elif topic == 'application.received':
        recruiter_id = payload.get('recruiter_id')
        job_title = payload.get('job_title', 'your job')
        seeker_email = payload.get('seeker_email', 'A candidate')
        if recruiter_id:
            NotificationDAO.create_notification(
                user_id=recruiter_id,
                notification_type=topic,
                title='New application received',
                body=f"New application from {seeker_email} for {job_title}",
                payload=payload,
            )

    elif topic == 'chat.message_sent':
        recipient_id = payload.get('recipient_id')
        body_preview = payload.get('body_preview', '')
        if recipient_id:
            NotificationDAO.create_notification(
                user_id=recipient_id,
                notification_type=topic,
                title='New message received',
                body=f"You received a new message: {body_preview}",
                payload=payload,
            )

class Command(BaseCommand):
    help = 'Consume Kafka notification events and persist in-app notifications.'

    def handle(self, *args, **options):
        consumer = KafkaConsumer(
            *TOPICS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            group_id='notification_service_group',
        )
        self.stdout.write(self.style.SUCCESS(f'Listening on topics: {TOPICS}'))

        for message in consumer:
            # Safe execution with retry and DLQ fallback
            KafkaConsumerClient.process_message_with_retry(
                message=message,
                handler_func=handle_notification_event,
                max_retries=3
            )
