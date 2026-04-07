from django.urls import path
from .views import ConversationListCreateView, HealthView, MessageListCreateView

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('conversations/', ConversationListCreateView.as_view()),
    path('conversations/<uuid:conversation_id>/messages/', MessageListCreateView.as_view()),
]
