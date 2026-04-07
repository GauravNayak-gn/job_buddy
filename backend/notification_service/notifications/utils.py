from django.conf import settings
from django.core.mail import send_mail
from .models import Notification


def create_notification(user_id, notification_type, title, body, payload=None):
    return Notification.objects.create(
        user_id=user_id,
        notification_type=notification_type,
        title=title,
        body=body,
        payload=payload or {},
    )


def send_notification_email(to_email, subject, message):
    if not to_email or not settings.EMAIL_HOST_USER:
        return
    try:
        send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=True)
    except Exception:
        pass
