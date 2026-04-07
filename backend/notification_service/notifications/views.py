from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification
from .serializers import NotificationSerializer


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'notifications'})


class NotificationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        only_unread = request.GET.get('unread') == 'true'
        queryset = Notification.objects.filter(user_id=request.user.id)
        if only_unread:
            queryset = queryset.filter(is_read=False)
        return Response(NotificationSerializer(queryset[:100], many=True).data)


class NotificationUnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(user_id=request.user.id, is_read=False).count()
        return Response({'unread_count': count})


class NotificationMarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, user_id=request.user.id)
        except Notification.DoesNotExist:
            return Response({'error': 'Notification not found.'}, status=status.HTTP_404_NOT_FOUND)

        notification.is_read = True
        notification.read_at = timezone.now()
        notification.save(update_fields=['is_read', 'read_at'])
        return Response({'message': 'Notification marked as read.'})


class NotificationMarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        Notification.objects.filter(user_id=request.user.id, is_read=False).update(is_read=True, read_at=now)
        return Response({'message': 'All notifications marked as read.'})
