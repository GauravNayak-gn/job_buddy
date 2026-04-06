import random
from datetime import timedelta
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from .models import EmailOTP


def generate_otp(user, purpose):
    EmailOTP.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)
    otp = EmailOTP.objects.create(
        user=user,
        otp_code=str(random.randint(100000, 999999)),
        purpose=purpose,
        expires_at=timezone.now() + timedelta(minutes=10),
    )
    return otp.otp_code


def send_otp_email(email, otp_code, purpose):
    subject = "Verify your email" if purpose == 'verify_email' else "Reset your password"
    send_mail(subject, f"Your OTP is: {otp_code}. Valid for 10 minutes.", settings.DEFAULT_FROM_EMAIL, [email])


def verify_otp(user, otp_code, purpose):
    otp = EmailOTP.objects.filter(
        user=user, otp_code=otp_code, purpose=purpose,
        is_used=False, expires_at__gt=timezone.now()
    ).first()
    if not otp:
        return False
    otp.is_used = True
    otp.save()
    return True
