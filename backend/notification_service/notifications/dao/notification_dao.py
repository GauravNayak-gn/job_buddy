from django.utils import timezone
from notifications.models import Notification


class NotificationDAO:
    @staticmethod
    def get_notifications(user_id, only_unread=False):
        queryset = Notification.objects.filter(user_id=user_id)
        if only_unread:
            queryset = queryset.filter(is_read=False)
        return queryset

    @staticmethod
    def get_unread_count(user_id):
        return Notification.objects.filter(user_id=user_id, is_read=False).count()

    @staticmethod
    def get_notification(notification_id, user_id):
        return Notification.objects.get(id=notification_id, user_id=user_id)

    @staticmethod
    def mark_as_read(notification):
        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=['is_read', 'read_at'])
        return notification

    @staticmethod
    def mark_all_as_read(user_id):
        now = timezone.now()
        Notification.objects.filter(user_id=user_id, is_read=False).update(is_read=True, read_at=now)

    @staticmethod
    def create_notification(user_id, notification_type, title, body, payload=None):
        return Notification.objects.create(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            payload=payload or {},
        )
