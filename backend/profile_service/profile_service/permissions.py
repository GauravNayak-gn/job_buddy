from rest_framework.permissions import BasePermission

class IsSeeker(BasePermission):
    message = "Only job seekers have access to this resource."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'seeker')

class IsRecruiter(BasePermission):
    message = "Only recruiters have access to this resource."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'recruiter')

class IsAdmin(BasePermission):
    message = "Only administrators have access to this resource."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and getattr(request.user, 'role', '') == 'admin')
