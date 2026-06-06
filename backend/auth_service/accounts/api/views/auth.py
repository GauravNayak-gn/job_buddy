from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from django.conf import settings

from accounts.api.serializers.auth import (
    RegisterSerializer, LoginSerializer, OTPSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer
)
from accounts.handlers import auth_handler
from accounts.services import auth_service
from accounts.dao import user_dao

class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "auth"})

class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        try:
            user, otp, email_sent = auth_handler.handle_user_registration(serializer.validated_data)
        except Exception:
            return Response({"error": "Registration failed. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        if email_sent:
            return Response({"message": "Registered. Check email for OTP."}, status=status.HTTP_201_CREATED)

        if settings.DEBUG:
            return Response({
                "message": "Registered. OTP email delivery failed in local setup; use this OTP for verification.",
                "otp_code": otp,
            }, status=status.HTTP_201_CREATED)

        return Response({
            "message": "Registered, but OTP email delivery failed. Please retry shortly."
        }, status=status.HTTP_201_CREATED)

class VerifyOTPView(APIView):
    def post(self, request):
        serializer = OTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        is_valid, msg, user = auth_service.verify_otp_service(
            serializer.validated_data['email'],
            serializer.validated_data['otp_code'],
            'verify_email'
        )
        if not is_valid:
            if msg == "User not found.":
                return Response({"error": msg}, status=status.HTTP_404_NOT_FOUND)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
        
        user_dao.verify_user(user)
        return Response({"message": "Email verified."})

from accounts.services.redis_client import RedisClient

def get_client_ip(request):
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip

class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email'].strip().lower()
        ip = get_client_ip(request)
        rate_limit_key = f"rate_limit_login:{ip}:{email}"
        
        if RedisClient.is_rate_limited(rate_limit_key, limit=5, period=60):
            return Response(
                {"error": "Too many login attempts. Please try again in a minute."},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )
            
        user, error = auth_service.authenticate_user(
            serializer.validated_data['email'],
            serializer.validated_data['password']
        )
        if error:
            return Response({"error": error}, status=status.HTTP_400_BAD_REQUEST)
            
        tokens = auth_service.generate_tokens_for_user(user)
        return Response(tokens)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('refresh')
        if not token:
            return Response({"error": "refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        
        auth_service.blacklist_token(token)
        return Response({"message": "Logged out."})

class ForgotPasswordView(APIView):
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        auth_handler.handle_forgot_password(serializer.validated_data['email'])
        return Response({"message": "If that email exists, an OTP has been sent."})

class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        is_valid, msg, user = auth_service.verify_otp_service(
            serializer.validated_data['email'],
            serializer.validated_data['otp_code'],
            'reset_password'
        )
        if not is_valid:
            if msg == "User not found.":
                return Response({"error": msg}, status=status.HTTP_404_NOT_FOUND)
            return Response({"error": msg}, status=status.HTTP_400_BAD_REQUEST)
            
        user_dao.update_password(user, serializer.validated_data['new_password'])
        return Response({"message": "Password reset successful."})
