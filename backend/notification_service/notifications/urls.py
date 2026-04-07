from django.urls import path
from .views import (
    HealthView,
    NotificationListView,
    NotificationMarkAllReadView,
    NotificationMarkReadView,
    NotificationUnreadCountView,
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('', NotificationListView.as_view()),
    path('unread-count/', NotificationUnreadCountView.as_view()),
    path('mark-all-read/', NotificationMarkAllReadView.as_view()),
    path('<uuid:notification_id>/mark-read/', NotificationMarkReadView.as_view()),
]
