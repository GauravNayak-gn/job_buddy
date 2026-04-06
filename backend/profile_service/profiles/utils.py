import uuid
import boto3
import fitz  # PyMuPDF
from django.conf import settings
from kafka import KafkaProducer
import json


def upload_to_s3(file, seeker_id):
    s3 = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )
    key = f"resumes/{seeker_id}/{uuid.uuid4()}.pdf"
    s3.upload_fileobj(file, settings.AWS_STORAGE_BUCKET_NAME, key)
    return key


def extract_text_from_pdf(file):
    try:
        file.seek(0)
        doc = fitz.open(stream=file.read(), filetype="pdf")
        return "\n".join(page.get_text() for page in doc)
    except Exception as e:
        return ""


def get_presigned_url(s3_key):
    s3 = boto3.client(
        's3',
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_S3_REGION_NAME,
    )
    return s3.generate_presigned_url(
        'get_object',
        Params={'Bucket': settings.AWS_STORAGE_BUCKET_NAME, 'Key': s3_key},
        ExpiresIn=3600
    )


def publish_resume_uploaded(resume_id, seeker_id, raw_text):
    try:
        producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS if hasattr(settings, 'KAFKA_BOOTSTRAP_SERVERS') else 'localhost:9092',
            value_serializer=lambda v: json.dumps(v).encode('utf-8')
        )
        producer.send('resume.uploaded', {
            'resume_id': str(resume_id),
            'seeker_id': str(seeker_id),
            'raw_text': raw_text,
        })
        producer.flush()
    except Exception:
        pass  # Kafka not running locally yet, skip silently
