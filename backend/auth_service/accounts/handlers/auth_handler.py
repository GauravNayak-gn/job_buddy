from accounts.dao import user_dao
from accounts.services import auth_service
from accounts.services.kafka_service import publish_user_registered
from django.db import transaction

def handle_user_registration(validated_data):
    with transaction.atomic():
        user = user_dao.create_user(
            email=validated_data['email'],
            password=validated_data['password'],
            role=validated_data['role']
        )
        otp_code, email_sent = auth_service.generate_and_send_otp(user, 'verify_email')
    
    publish_user_registered(user)
    return user, otp_code, email_sent

def handle_forgot_password(email: str):
    user = user_dao.get_user_by_email(email)
    if user:
        auth_service.generate_and_send_otp(user, 'reset_password')
