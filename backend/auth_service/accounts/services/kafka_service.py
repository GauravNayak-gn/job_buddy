from accounts.services.kafka_client import KafkaProducerClient

def publish_user_registered(user) -> None:
    payload = {
        'user_id': str(user.id),
        'email': user.email,
        'role': user.role,
    }
    KafkaProducerClient.publish('user.registered', payload)
