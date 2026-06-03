from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Conversation, Message
from .serializers import ConversationSerializer, MessageSerializer


def conversation_has_user(conversation, user_id):
    return str(conversation.participant_a) == str(user_id) or str(conversation.participant_b) == str(user_id)


class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'chat'})


class ConversationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user_id = request.user.id
        items = Conversation.objects.filter(participant_a=user_id) | Conversation.objects.filter(participant_b=user_id)
        return Response(ConversationSerializer(items.order_by('-updated_at'), many=True).data)

    def post(self, request):
        other_user_id = request.data.get('other_user_id')
        if not other_user_id:
            return Response({'error': 'other_user_id is required.'}, status=400)

        user_id = request.user.id
        conversation = Conversation.objects.filter(participant_a=user_id, participant_b=other_user_id).first()
        if not conversation:
            conversation = Conversation.objects.filter(participant_a=other_user_id, participant_b=user_id).first()

        if not conversation:
            conversation = Conversation.objects.create(participant_a=user_id, participant_b=other_user_id)

        return Response(ConversationSerializer(conversation).data)


class MessageListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found.'}, status=404)
        if not conversation_has_user(conversation, request.user.id):
            return Response({'error': 'Forbidden.'}, status=403)
        messages = Message.objects.filter(conversation=conversation).order_by('created_at')
        return Response(MessageSerializer(messages, many=True).data)

    def post(self, request, conversation_id):
        body = request.data.get('body', '').strip()
        if not body:
            return Response({'error': 'body is required.'}, status=400)

        try:
            conversation = Conversation.objects.get(id=conversation_id)
        except Conversation.DoesNotExist:
            return Response({'error': 'Conversation not found.'}, status=404)
        if not conversation_has_user(conversation, request.user.id):
            return Response({'error': 'Forbidden.'}, status=403)

        message = Message.objects.create(
            conversation=conversation,
            sender_id=request.user.id,
            body=body,
        )

        conversation.save(update_fields=['updated_at'])

        # Centralized event publishing
        recipient_id = conversation.participant_b if str(conversation.participant_a) == str(request.user.id) else conversation.participant_a
        payload = {
            'message_id': str(message.id),
            'conversation_id': str(conversation.id),
            'sender_id': str(request.user.id),
            'recipient_id': str(recipient_id),
            'body_preview': message.body[:100],
        }
        from chat.services.kafka_client import KafkaProducerClient
        KafkaProducerClient.publish('chat.message_sent', payload)

        return Response(MessageSerializer(message).data, status=201)

