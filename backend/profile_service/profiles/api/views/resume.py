from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from profile_service.permissions import IsSeeker
from rest_framework.parsers import MultiPartParser
from django.http import FileResponse, Http404
from django.core.files.storage import default_storage

from profiles.api.serializers.resume import ResumeSerializer
from profiles.services import resume as resume_service
from profiles.handlers import resume as resume_handlers
from profiles.utils import get_presigned_url

class ResumeUploadView(APIView):
    permission_classes = [IsAuthenticated, IsSeeker]
    parser_classes = [MultiPartParser]

    def get(self, request):
        resumes, err = resume_service.get_seeker_resumes(request.user.id)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
        return Response(ResumeSerializer(resumes, many=True).data)

    def post(self, request):
        file = request.FILES.get('resume')
        if not file or not file.name.endswith('.pdf'):
            return Response({"error": "PDF file required."}, status=status.HTTP_400_BAD_REQUEST)

        resume_title = request.data.get('resume_title')
        resume, err = resume_handlers.handle_resume_upload(request.user.id, file, resume_title)
        
        if err:
            # simple heuristic for error status
            status_code = status.HTTP_404_NOT_FOUND if "not found" in err else status.HTTP_500_INTERNAL_SERVER_ERROR
            return Response({"error": err}, status=status_code)
            
        return Response(ResumeSerializer(resume).data, status=status.HTTP_201_CREATED)


class ResumeDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSeeker]

    def delete(self, request, resume_id):
        err = resume_handlers.handle_resume_deletion(request.user.id, resume_id)
        if err:
            return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def patch(self, request, resume_id):
        is_primary = request.data.get('is_primary')
        if is_primary is not None:
            resume, err = resume_service.update_resume_primary_status(request.user.id, resume_id, is_primary)
            if err:
                return Response({"error": err}, status=status.HTTP_404_NOT_FOUND)
            return Response(ResumeSerializer(resume).data)
        
        return Response({"error": "No valid data provided."}, status=status.HTTP_400_BAD_REQUEST)


class ResumeURLView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, resume_id):
        resume, err = resume_service.check_resume_access(request.user.id, resume_id)
        if err:
            status_code = status.HTTP_403_FORBIDDEN if "Forbidden" in err else status.HTTP_404_NOT_FOUND
            return Response({"error": err}, status=status_code)
            
        url = get_presigned_url(resume.local_path)
        return Response({"url": url})


class ResumeDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, resume_id):
        resume, err = resume_service.check_resume_access(request.user.id, resume_id)
        if err:
            if "Forbidden" in err:
                return Response({"error": err}, status=status.HTTP_403_FORBIDDEN)
            raise Http404(err)
            
        if not default_storage.exists(resume.local_path):
            raise Http404("Resume file not found.")
        
        file = default_storage.open(resume.local_path, 'rb')
        response = FileResponse(file, content_type='application/pdf')
        response['Content-Disposition'] = f'inline; filename="{resume.resume_title}"'
        return response