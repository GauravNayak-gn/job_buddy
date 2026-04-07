import jwt
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class JWTAuthentication(BaseAuthentication):
    def authenticate(self, request):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return None
        token = auth_header.split(' ')[1]
        try:
            decoded = jwt.decode(token, options={"verify_signature": False})
            user_id = decoded.get('user_id')
            role = decoded.get('role', '')
            if not user_id:
                raise AuthenticationFailed('Invalid token payload.')
            return (type('User', (), {'id': user_id, 'role': role, 'is_authenticated': True})(), token)
        except Exception:
            raise AuthenticationFailed('Invalid or expired token.')
