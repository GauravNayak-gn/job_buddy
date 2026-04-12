from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.core.cache import cache
from .models import Job, JobCategory
from .serializers import JobSerializer, JobCategorySerializer
from .utils import publish_job_published


class HealthView(APIView):
    def get(self, request):
        return Response({"status": "ok", "service": "jobs"})


class JobCategoryListView(APIView):
    def get(self, request):
        return Response(JobCategorySerializer(JobCategory.objects.all(), many=True).data)


class JobListView(APIView):
    def get(self, request):
        cache_key = f"jobs_list_{request.GET.urlencode()}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        jobs = Job.objects.filter(status='published', is_archived=False).select_related('category').prefetch_related('skills')

        # filters
        location_type = request.GET.get('location_type')
        category = request.GET.get('category')
        search = request.GET.get('search')

        if location_type:
            jobs = jobs.filter(location_type=location_type)
        if category:
            jobs = jobs.filter(category__name__icontains=category)
        if search:
            jobs = jobs.filter(title__icontains=search) | jobs.filter(description__icontains=search)

        data = JobSerializer(jobs.order_by('-created_at'), many=True).data
        cache.set(cache_key, data, timeout=300)  # cache 5 minutes
        return Response(data)


class JobCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if request.user.role != 'recruiter':
            return Response({"error": "Only recruiters can post jobs."}, status=status.HTTP_403_FORBIDDEN)
        serializer = JobSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        job = serializer.save(recruiter_id=request.user.id)
        return Response(JobSerializer(job).data, status=status.HTTP_201_CREATED)


class JobDetailView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id)
            if job.is_archived and str(job.recruiter_id) != str(getattr(request.user, 'id', '')):
                return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
            return Response(JobSerializer(job).data)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)

    def patch(self, request, job_id):
        if not getattr(request.user, 'is_authenticated', False):
            return Response({"error": "Authentication required."}, status=status.HTTP_401_UNAUTHORIZED)
        try:
            job = Job.objects.get(id=job_id, recruiter_id=request.user.id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        if job.is_archived:
            return Response({"error": "Archived jobs cannot be edited until restored."}, status=status.HTTP_400_BAD_REQUEST)
        serializer = JobSerializer(job, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        cache.delete_pattern("jobs_list_*")
        return Response(JobSerializer(job).data)


class JobPublishView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, recruiter_id=request.user.id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        if job.is_archived:
            return Response({"error": "Restore the job before publishing it."}, status=status.HTTP_400_BAD_REQUEST)
        job.status = 'published'
        job.save()
        publish_job_published(job.id, job.description)
        cache.delete_pattern("jobs_list_*")
        return Response({"message": "Job published."})


class JobCloseView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, recruiter_id=request.user.id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        job.status = 'closed'
        job.save()
        cache.delete_pattern("jobs_list_*")
        return Response({"message": "Job closed."})


class JobArchiveView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, recruiter_id=request.user.id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        job.archive()
        job.save(update_fields=['is_archived', 'archived_at', 'status', 'updated_at'])
        cache.delete_pattern("jobs_list_*")
        return Response({"message": "Job archived."})


class JobRestoreView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, job_id):
        try:
            job = Job.objects.get(id=job_id, recruiter_id=request.user.id)
        except Job.DoesNotExist:
            return Response({"error": "Job not found."}, status=status.HTTP_404_NOT_FOUND)
        job.restore()
        job.save(update_fields=['is_archived', 'archived_at', 'updated_at'])
        cache.delete_pattern("jobs_list_*")
        return Response({"message": "Job restored. Publish it again when ready."})


class RecruiterJobListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        jobs = Job.objects.filter(recruiter_id=request.user.id).order_by('-created_at')
        return Response(JobSerializer(jobs, many=True).data)
