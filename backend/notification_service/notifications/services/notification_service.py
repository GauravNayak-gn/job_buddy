from django.conf import settings
from django.core.mail import send_mail
from notifications.dao.notification_dao import NotificationDAO
from notifications.models import Notification


class NotificationService:
    @staticmethod
    def get_user_notifications(user_id, only_unread):
        return NotificationDAO.get_notifications(user_id, only_unread)

    @staticmethod
    def get_unread_count(user_id):
        return NotificationDAO.get_unread_count(user_id)

    @staticmethod
    def mark_notification_as_read(notification_id, user_id):
        try:
            notification = NotificationDAO.get_notification(notification_id, user_id)
            return NotificationDAO.mark_as_read(notification)
        except Notification.DoesNotExist:
            return None

    @staticmethod
    def mark_all_as_read(user_id):
        NotificationDAO.mark_all_as_read(user_id)

    @staticmethod
    def create_and_send_notification(user_id, notification_type, title, body, payload=None, to_email=None):
        notification = NotificationDAO.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            payload=payload
        )
        if to_email:
            NotificationService.send_email(to_email, title, body)
        return notification

    @staticmethod
    def send_email(to_email, subject, message):
        if not to_email or not settings.EMAIL_HOST_USER:
            return
        try:
            send_mail(subject, message, settings.DEFAULT_FROM_EMAIL, [to_email], fail_silently=True)
        except Exception:
            pass
