from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.api.serializers.notification import NotificationSerializer
from notifications.services.notification_service import NotificationService


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'notifications'})


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        only_unread = request.GET.get('unread') == 'true'
        queryset = NotificationService.get_user_notifications(request.user.id, only_unread)
        return Response(NotificationSerializer(queryset[:100], many=True).data)


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = NotificationService.get_unread_count(request.user.id)
        return Response({'unread_count': count})


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        notification = NotificationService.mark_notification_as_read(notification_id, request.user.id)
        if not notification:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        return Response({'message': 'Notification marked as read.'})


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        NotificationService.mark_all_as_read(request.user.id)
        return Response({'message': 'All notifications marked as read.'})
