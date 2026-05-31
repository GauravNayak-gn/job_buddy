from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from accounts.api.views.auth import (
    HealthView, RegisterView, VerifyOTPView, LoginView,
    LogoutView, ForgotPasswordView, ResetPasswordView
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('register/', RegisterView.as_view()),
    path('verify-otp/', VerifyOTPView.as_view()),
    path('login/', LoginView.as_view()),
    path('logout/', LogoutView.as_view()),
    path('token/refresh/', TokenRefreshView.as_view()),
    path('forgot-password/', ForgotPasswordView.as_view()),
    path('reset-password/', ResetPasswordView.as_view()),
]
