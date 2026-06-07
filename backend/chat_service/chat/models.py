import uuid
from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    participant_a = models.UUIDField(db_index=True)
    participant_b = models.UUIDField(db_index=True)
    job_id = models.UUIDField(db_index=True, null=True, blank=True)
    job_title = models.CharField(max_length=250, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'conversations'


class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name='messages')
    sender_id = models.UUIDField(db_index=True)
    body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'messages'
        ordering = ['created_at']
