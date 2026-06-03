from django.contrib.auth import authenticate
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.cache import cache
from accounts.dao import user_dao, otp_dao
from accounts.services.email_service import send_otp_email
from accounts.services.redis_client import RedisClient
from django.utils import timezone
from datetime import timedelta
import random
import logging

logger = logging.getLogger(__name__)

def generate_and_send_otp(user, purpose: str) -> tuple[str, bool]:
    otp_code = str(random.randint(100000, 999999))
    redis_key = f"otp:{user.id}:{purpose}"
    
    # Try Redis first
    redis_success = RedisClient.set(redis_key, otp_code, timeout=600)  # 10 minutes TTL
    
    # If Redis failed, or as an absolute fallback, we write to DB
    if not redis_success:
        logger.warning("Redis is down or failed. Falling back to DB for OTP generation for user %s", user.email)
        otp_dao.invalidate_old_otps(user, purpose)
        expires_at = timezone.now() + timedelta(minutes=10)
        otp_dao.create_otp_record(user, otp_code, purpose, expires_at)
        
    email_sent = send_otp_email(user.email, otp_code, purpose)
    return otp_code, email_sent

def verify_otp_service(email: str, otp_code: str, purpose: str) -> tuple[bool, str, any]:
    user = user_dao.get_user_by_email(email)
    if not user:
        return False, "User not found.", None
        
    redis_key = f"otp:{user.id}:{purpose}"
    cached_otp = RedisClient.get(redis_key)
    
    if cached_otp is not None:
        if cached_otp == otp_code:
            RedisClient.delete(redis_key)
            return True, "", user
        else:
            return False, "Invalid or expired OTP.", None
            
    # Fallback to DB if not found in Redis (e.g. Redis was down or key expired in Redis but might be in DB)
    logger.info("OTP not found in Redis (or Redis down). Checking DB for user %s", email)
    otp_record = otp_dao.get_valid_otp(user, otp_code, purpose)
    if not otp_record:
        return False, "Invalid or expired OTP.", None
        
    otp_dao.mark_otp_used(otp_record)
    return True, "", user

def authenticate_user(email, password):
    email = email.strip().lower()
    user = authenticate(username=email, password=password)
    if not user:
        return None, "Invalid credentials."
    if not user.is_active:
        return None, "User account is inactive."
    if not user.is_verified:
        return None, "Email not verified."
    return user, ""

def generate_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    refresh['role'] = user.role
    refresh['email'] = user.email
    return {
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "role": user.role,
        "user_id": str(user.id),
    }

def blacklist_token(token: str):
    try:
        refresh = RefreshToken(token)
        refresh.blacklist()
    except Exception:
        RedisClient.set(f"blacklist_{token}", "1", timeout=60 * 60 * 24 * 7)

