from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated

from profiles.api.serializers.profile import (
    SeekerProfileSerializer, RecruiterProfileSerializer,
    SkillSerializer, SeekerSkillSerializer, ExperienceSerializer
)
from profiles.services import profile as profile_service


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "profile"})


from profiles.services.redis_client import RedisClient
from profiles.dao import profile as profile_dao

def clear_seeker_profile_cache(user_id, seeker_id=None):
    RedisClient.delete(f"profile:seeker:user:{user_id}")
    if seeker_id:
        RedisClient.delete(f"profile:seeker:by_id:{seeker_id}")
    else:
        profile = profile_dao.get_seeker_profile(user_id)
        if profile:
            RedisClient.delete(f"profile:seeker:by_id:{profile.id}")

def clear_recruiter_profile_cache(user_id):
    RedisClient.delete(f"profile:recruiter:user:{user_id}")

class SeekerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f"profile:seeker:user:{request.user.id}"
        cached = RedisClient.get(cache_key)
        if cached:
            return Response(cached)
            
        profile = profile_service.get_seeker_profile(request.user.id)
        if not profile:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
        data = SeekerProfileSerializer(profile).data
        RedisClient.set(cache_key, data, timeout=3600)
        return Response(data)

    def post(self, request):
        serializer = SeekerProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile, err = profile_service.create_seeker_profile(request.user.id, serializer.validated_data)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
            
        clear_seeker_profile_cache(request.user.id, profile.id)
        return Response(SeekerProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        serializer = SeekerProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile, err = profile_service.update_seeker_profile(request.user.id, serializer.validated_data)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
            
        clear_seeker_profile_cache(request.user.id, profile.id)
        return Response(SeekerProfileSerializer(profile).data)


class RecruiterProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        cache_key = f"profile:recruiter:user:{request.user.id}"
        cached = RedisClient.get(cache_key)
        if cached:
            return Response(cached)
            
        profile = profile_service.get_recruiter_profile(request.user.id)
        if not profile:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
        data = RecruiterProfileSerializer(profile).data
        RedisClient.set(cache_key, data, timeout=3600)
        return Response(data)

    def post(self, request):
        serializer = RecruiterProfileSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile, err = profile_service.create_recruiter_profile(request.user.id, serializer.validated_data)
        if err:
            return Response({"error": err}, status=status.HTTP_400_BAD_REQUEST)
            
        clear_recruiter_profile_cache(request.user.id)
        return Response(RecruiterProfileSerializer(profile).data, status=status.HTTP_201_CREATED)

    def patch(self, request):
        serializer = RecruiterProfileSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        profile, err = profile_service.update_recruiter_profile(request.user.id, serializer.validated_data)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
            
        clear_recruiter_profile_cache(request.user.id)
        return Response(RecruiterProfileSerializer(profile).data)


class SkillListView(APIView):
    def get(self, request):
        skills = profile_service.get_all_skills()
        return Response(SkillSerializer(skills, many=True).data)


class SeekerSkillView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        skills, err = profile_service.get_seeker_skills(request.user.id)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
        return Response(SeekerSkillSerializer(skills, many=True).data)

    def post(self, request):
        skill_name = request.data.get('skill_name', '')
        years = request.data.get('years_of_experience', 0)
        obj, created, err = profile_service.add_seeker_skill(request.user.id, skill_name, years)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
            
        clear_seeker_profile_cache(request.user.id)
        return Response(SeekerSkillSerializer(obj).data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class ExperienceView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        experiences, err = profile_service.get_seeker_experiences(request.user.id)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
        return Response(ExperienceSerializer(experiences, many=True).data)

    def post(self, request):
        serializer = ExperienceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exp, err = profile_service.add_experience(request.user.id, serializer.validated_data)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
            
        clear_seeker_profile_cache(request.user.id)
        return Response(ExperienceSerializer(exp).data, status=status.HTTP_201_CREATED)


class SeekerProfileByIdView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, seeker_id):
        cache_key = f"profile:seeker:by_id:{seeker_id}"
        cached = RedisClient.get(cache_key)
        if cached:
            return Response(cached)
            
        profile = profile_service.get_seeker_profile_by_id(seeker_id)
        if not profile:
            return Response({"error": "Profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
        data = SeekerProfileSerializer(profile).data
        data['skills'] = SeekerSkillSerializer(profile.skills.all(), many=True).data
        data['experiences'] = ExperienceSerializer(profile.experiences.all(), many=True).data
        
        RedisClient.set(cache_key, data, timeout=3600)
        return Response(data)