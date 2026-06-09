import os
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from django.urls import path
from chat_service.middleware import JWTAuthMiddleware
from chat.consumers import ChatConsumer

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'chat_service.settings')
django_asgi_app = get_asgi_application()

# Import consumers and middleware after setting django settings module and setup

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": JWTAuthMiddleware(
        URLRouter([
            path("api/chat/ws/", ChatConsumer.as_asgi()),
        ])
    ),
})
