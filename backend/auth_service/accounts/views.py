from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from django.db import transaction
from django.core.cache import cache
from .models import User
from .serializers import (
    RegisterSerializer, LoginSerializer, OTPSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer
)
from .utils import generate_otp, send_otp_email, verify_otp, publish_user_registered


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "auth"})


class RegisterView(APIView):
    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                user = serializer.save()
                otp = generate_otp(user, 'verify_email')
                send_otp_email(user.email, otp, 'verify_email')
        except Exception:
            return Response({"error": "Registration failed. Please try again."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        publish_user_registered(user)
        return Response({"message": "Registered. Check email for OTP."}, status=status.HTTP_201_CREATED)


class VerifyOTPView(APIView):
    def post(self, request):
        serializer = OTPSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(email__iexact=serializer.validated_data['email'].strip())
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not verify_otp(user, serializer.validated_data['otp_code'], 'verify_email'):
            return Response({"error": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
        user.is_verified = True
        user.save()
        return Response({"message": "Email verified."})


class LoginView(APIView):
    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        refresh['role'] = user.role
        refresh['email'] = user.email
        return Response({
            "access": str(refresh.access_token),
            "refresh": str(refresh),
            "role": user.role,
            "user_id": str(user.id),
        })


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        token = request.data.get('refresh')
        if not token:
            return Response({"error": "refresh token is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            refresh = RefreshToken(token)
            refresh.blacklist()
        except Exception:
            cache.set(f"blacklist_{token}", "1", timeout=60 * 60 * 24 * 7)
        return Response({"message": "Logged out."})


class ForgotPasswordView(APIView):
    def post(self, request):
        serializer = ForgotPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(email__iexact=serializer.validated_data['email'].strip())
            otp = generate_otp(user, 'reset_password')
            send_otp_email(user.email, otp, 'reset_password')
        except User.DoesNotExist:
            pass  # Don't reveal if email exists
        return Response({"message": "If that email exists, an OTP has been sent."})


class ResetPasswordView(APIView):
    def post(self, request):
        serializer = ResetPasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            user = User.objects.get(email__iexact=serializer.validated_data['email'].strip())
        except User.DoesNotExist:
            return Response({"error": "User not found."}, status=status.HTTP_404_NOT_FOUND)
        if not verify_otp(user, serializer.validated_data['otp_code'], 'reset_password'):
            return Response({"error": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)
        user.set_password(serializer.validated_data['new_password'])
        user.save()
        return Response({"message": "Password reset successful."})
