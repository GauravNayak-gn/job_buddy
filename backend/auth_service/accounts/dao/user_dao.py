from accounts.models import User

def get_user_by_email(email: str) -> User | None:
    try:
        return User.objects.get(email__iexact=email.strip())
    except User.DoesNotExist:
        return None

def create_user(email: str, password: str, role: str) -> User:
    return User.objects.create_user(email=email, password=password, role=role)

def verify_user(user: User) -> None:
    user.is_verified = True
    user.save(update_fields=['is_verified'])

def update_password(user: User, new_password: str) -> None:
    user.set_password(new_password)
    user.save(update_fields=['password'])

def user_exists_by_email(email: str) -> bool:
    return User.objects.filter(email__iexact=email.strip()).exists()
