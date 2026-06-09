import jwt
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from urllib.parse import parse_qs

@database_sync_to_async
def get_user(token):
    try:
        decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = decoded.get('user_id')
        role = decoded.get('role', '')
        email = decoded.get('email', '')
        if not user_id:
            return AnonymousUser()
        # Create a mock user object representing the authenticated user
        return type('User', (), {'id': user_id, 'role': role, 'email': email, 'is_authenticated': True})()
    except Exception:
        return AnonymousUser()

class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        query_string = scope.get("query_string", b"").decode("utf-8")
        query_params = parse_qs(query_string)
        token = query_params.get("token", [None])[0]
        
        if token:
            scope["user"] = await get_user(token)
        else:
            scope["user"] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)
