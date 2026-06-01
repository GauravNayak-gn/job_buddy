from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.cache import cache

from jobs.api.serializers.job_serializers import JobSerializer, JobCategorySerializer
from jobs.services import job_service
from jobs.dao import job_dao

def request_user_is_recruiter(user):
    return getattr(user, 'role', '') == 'recruiter'

class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "jobs"})

class JobCategoryListView(APIView):
    def get(self, request):
        categories = job_dao.get_job_categories()
        return Response(JobCategorySerializer(categories, many=True).data)

class JobListView(APIView):
    def get(self, request):
        cache_key = f"jobs_list_{request.GET.urlencode()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        location_type = request.GET.get('location_type')
        category = request.GET.get('category')
        search = request.GET.get('search')

        jobs = job_dao.get_active_jobs(location_type=location_type, category=category, search=search)
        data = JobSerializer(jobs, many=True).data
        cache.set(cache_key, data, timeout=300)
        return Response(data)

class JobCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not request_user_is_recruiter(request.user):
            return Response({"error": "Only recruiters can post jobs."}, status=status.HTTP_403_FORBIDDEN)
        
        serializer = JobSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        validated_data = serializer.validated_data
        skills_data = validated_data.pop('skills', [])
        
        job = job_service.create_job(validated_data, skills_data, request.user.id)
        return Response(JobSerializer(job).data, status=status.HTTP_201_CREATED)

class JobDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        try:
            user_id = getattr(request.user, 'id', '')
            job = job_service.get_job_for_detail(job_id, user_id)
            return Response(JobSerializer(job).data)
        except (ValueError, job_dao.Job.DoesNotExist):
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, job_id):
        if not getattr(request.user, 'is_authenticated', False):
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            job = job_dao.get_job_by_id_and_recruiter(job_id, request.user.id)
            
            serializer = JobSerializer(job, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            
            validated_data = serializer.validated_data
            skills_data = validated_data.pop('skills', None)
            
            job = job_service.update_job(job, validated_data, skills_data)
            return Response(JobSerializer(job).data)
            
        except job_dao.Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class JobPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        if not request_user_is_recruiter(request.user):
            return Response({"error": "Only recruiters can publish jobs."}, status=status.HTTP_403_FORBIDDEN)
        try:
            job = job_dao.get_job_by_id_and_recruiter(job_id, request.user.id)
            job_service.publish_job(job)
            return Response({"message": "Job published."})
        except job_dao.Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class JobCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        if not request_user_is_recruiter(request.user):
            return Response({"error": "Only recruiters can close jobs."}, status=status.HTTP_403_FORBIDDEN)
        try:
            job = job_dao.get_job_by_id_and_recruiter(job_id, request.user.id)
            job_service.close_job(job)
            return Response({"message": "Job closed."})
        except job_dao.Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

class JobArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        if not request_user_is_recruiter(request.user):
            return Response({"error": "Only recruiters can archive jobs."}, status=status.HTTP_403_FORBIDDEN)
        try:
            job = job_dao.get_job_by_id_and_recruiter(job_id, request.user.id)
            job_service.archive_job(job)
            return Response({"message": "Job archived."})
        except job_dao.Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

class JobRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        if not request_user_is_recruiter(request.user):
            return Response({"error": "Only recruiters can restore jobs."}, status=status.HTTP_403_FORBIDDEN)
        try:
            job = job_dao.get_job_by_id_and_recruiter(job_id, request.user.id)
            job_service.restore_job(job)
            return Response({"message": "Job restored. Publish it again when ready."})
        except job_dao.Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

class RecruiterJobListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not request_user_is_recruiter(request.user):
            return Response({"error": "Only recruiters can view recruiter jobs."}, status=status.HTTP_403_FORBIDDEN)
        jobs = job_dao.get_recruiter_jobs(request.user.id)
        return Response(JobSerializer(jobs, many=True).data)
