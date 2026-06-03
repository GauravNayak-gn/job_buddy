from jobs.services.kafka_client import KafkaProducerClient

def publish_job_published_event(job_id, description):
    payload = {
        'job_id': str(job_id),
        'description_text': description
    }
    KafkaProducerClient.publish('job.published', payload)
