from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView
from matching.services.matching_service import MatchingService

class JobsForSeekerView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, seeker_id):
        resume_id = request.query_params.get('resume_id')
        results = MatchingService.get_jobs_for_seeker(seeker_id, resume_id)
        return Response({'results': results})

class SeekersForJobView(APIView):
    permission_classes = [AllowAny]

    def get(self, request, job_id):
        results = MatchingService.get_seekers_for_job(job_id)
        return Response({'results': results})
