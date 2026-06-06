import json
import logging
from kafka import KafkaConsumer
from django.conf import settings
from django.core.management.base import BaseCommand

from matching.models import JobEmbedding, ResumeEmbedding
from matching.utils import generate_embedding
from matching.services.kafka_client import KafkaConsumerClient
from matching.services.redis_client import RedisClient

logger = logging.getLogger(__name__)
TOPICS = ['resume.uploaded', 'resume.deleted', 'job.published']

def handle_event(topic, payload):
    """
    Process incoming Kafka events and handle embedding updates.
    """
    if topic == 'resume.uploaded':
        resume_id = payload.get('resume_id')
        seeker_id = payload.get('seeker_id')
        raw_text = payload.get('raw_text', '')
        if resume_id and seeker_id:
            vector = generate_embedding(raw_text)
            ResumeEmbedding.objects.update_or_create(
                resume_id=resume_id,
                defaults={'seeker_id': seeker_id, 'embedding': vector},
            )
            # Invalidate recommendations cache for this seeker
            RedisClient.delete(f"matches:seeker:{seeker_id}")

    elif topic == 'resume.deleted':
        resume_id = payload.get('resume_id')
        seeker_id = payload.get('seeker_id')
        if resume_id:
            ResumeEmbedding.objects.filter(resume_id=resume_id).delete()
            if seeker_id:
                RedisClient.delete(f"matches:seeker:{seeker_id}")
            else:
                # Fallback to invalidating all matches if seeker_id is not present
                RedisClient.delete_pattern("matches:seeker:*")

    elif topic == 'job.published':
        job_id = payload.get('job_id')
        description_text = payload.get('description_text', '')
        if job_id:
            vector = generate_embedding(description_text)
            JobEmbedding.objects.update_or_create(
                job_id=job_id,
                defaults={'embedding': vector},
            )
            # Invalidate matching jobs cache since a new job is published
            RedisClient.delete_pattern("matches:seeker:*")
            RedisClient.delete(f"matches:job:{job_id}")

class Command(BaseCommand):
    help = 'Consume Kafka events and create/update/delete embeddings.'

    def handle(self, *args, **options):
        consumer = KafkaConsumer(
            *TOPICS,
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
            value_deserializer=lambda m: json.loads(m.decode('utf-8')),
            auto_offset_reset='latest',
            enable_auto_commit=True,
            group_id='matching_service_group',
        )
        self.stdout.write(self.style.SUCCESS(f'Listening on topics: {TOPICS}'))

        for message in consumer:
            # Safely process the message with retries and DLQ routing
            KafkaConsumerClient.process_message_with_retry(
                message=message,
                handler_func=handle_event,
                max_retries=3
            )
