from django.core.mail import send_mail
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

def send_otp_email(email: str, otp_code: str, purpose: str) -> bool:
    subject = "Verify your email" if purpose == 'verify_email' else "Reset your password"
    try:
        send_mail(
            subject, 
            f"Your OTP is: {otp_code}. Valid for 10 minutes.", 
            settings.DEFAULT_FROM_EMAIL, 
            [email]
        )
        return True
    except Exception as e:
        logger.error(f"Failed to send OTP email to {email}: {str(e)}")
        return False
