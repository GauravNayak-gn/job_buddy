from accounts.models import EmailOTP
from django.utils import timezone

def invalidate_old_otps(user, purpose: str):
    EmailOTP.objects.filter(user=user, purpose=purpose, is_used=False).update(is_used=True)

def create_otp_record(user, otp_code: str, purpose: str, expires_at) -> EmailOTP:
    return EmailOTP.objects.create(
        user=user,
        otp_code=otp_code,
        purpose=purpose,
        expires_at=expires_at
    )

def get_valid_otp(user, otp_code: str, purpose: str) -> EmailOTP | None:
    return EmailOTP.objects.filter(
        user=user, otp_code=otp_code, purpose=purpose,
        is_used=False, expires_at__gt=timezone.now()
    ).first()

def mark_otp_used(otp: EmailOTP) -> None:
    otp.is_used = True
    otp.save(update_fields=['is_used'])
