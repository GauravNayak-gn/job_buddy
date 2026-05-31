import json
from kafka import KafkaProducer
from django.conf import settings

def publish_user_registered(user) -> None:
    try:
        producer = KafkaProducer(
            bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS if hasattr(settings, 'KAFKA_BOOTSTRAP_SERVERS') else 'localhost:9092',
            value_serializer=lambda v: json.dumps(v).encode('utf-8'),
            connections_max_idle_ms=10000,
            request_timeout_ms=5000,
        )
        producer.send('user.registered', {
            'user_id': str(user.id),
            'email': user.email,
            'role': user.role,
        })
        producer.flush(timeout_secs=300)
    except Exception:
        pass
    finally:
        try:
            producer.close(timeout_secs=20)
        except:
            pass
