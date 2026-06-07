from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from django.http import Http404

from applications.api.serializers.application_serializers import (
    ApplicationSerializer,
    ApplicationStageHistorySerializer,
    InterviewScheduleSerializer,
    InterviewSerializer,
    StageUpdateSerializer,
)
from applications.services import application_service
from applications.handlers import application_handler

class HealthView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        return Response({'status': 'ok', 'service': 'applications'})


class ApplyView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not application_service.request_user_is_seeker(request.user):
            return Response({'error': 'Only seekers can apply.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = ApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        job_id = serializer.validated_data['job_id']
        resume_id = serializer.validated_data['resume_id']
        cover_letter = serializer.validated_data.get('cover_letter', '')
        screening_answers = serializer.validated_data.get('screening_answers', [])

        try:
            application = application_handler.handle_apply(
                user=request.user,
                job_id=job_id,
                resume_id=resume_id,
                cover_letter=cover_letter,
                screening_answers=screening_answers
            )
            return Response(ApplicationSerializer(application).data, status=status.HTTP_201_CREATED)
        except ValueError as e:
            if str(e) == "Job not found.":
                return Response({'error': str(e)}, status=status.HTTP_404_NOT_FOUND)
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class MyApplicationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        stage = request.query_params.get('stage')
        applications = application_service.get_seeker_applications(request.user.id, stage)
        return Response(ApplicationSerializer(applications, many=True).data)


class JobApplicationListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, job_id):
        if not application_service.request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can view job applications.'}, status=status.HTTP_403_FORBIDDEN)

        sort_by = request.query_params.get('sort_by', '-created_at')
        allowed_sorts = ['current_stage', '-current_stage', 'created_at', '-created_at']
        if sort_by not in allowed_sorts:
            sort_by = '-created_at'

        applications = application_service.get_recruiter_job_applications(job_id, request.user.id, sort_by)
        return Response(ApplicationSerializer(applications, many=True).data)


class ApplicationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = application_service.get_application(application_id)
        if not application:
            raise Http404
        if not application_service.user_can_access_application(request.user, application):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
        return Response(ApplicationSerializer(application).data)


class WithdrawApplicationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        application = application_service.get_application(application_id)
        if not application:
            raise Http404
        try:
            application_service.withdraw_application(application, request.user)
            return Response({'message': 'Application withdrawn.'})
        except PermissionError:
            return Response({'error': 'Not authorized to withdraw this application.'}, status=status.HTTP_403_FORBIDDEN)


class UpdateStageView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if not application_service.request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can update stage.'}, status=status.HTTP_403_FORBIDDEN)

        application = application_service.get_application(application_id)
        if not application:
            raise Http404
        if not application_service.recruiter_owns_application(application, request.user):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = StageUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_stage = serializer.validated_data['new_stage']
        note = serializer.validated_data.get('note', '')

        application, history = application_handler.handle_update_stage(request.user, application, new_stage, note)

        return Response({
            'application': ApplicationSerializer(application).data,
            'history': ApplicationStageHistorySerializer(history).data,
        })


class StageHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = application_service.get_application(application_id)
        if not application:
            raise Http404
        if not application_service.user_can_access_application(request.user, application):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        history = application_service.get_stage_history(application)
        return Response(ApplicationStageHistorySerializer(history, many=True).data)


class ScheduleInterviewView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, application_id):
        if not application_service.request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can schedule interviews.'}, status=status.HTTP_403_FORBIDDEN)

        application = application_service.get_application(application_id)
        if not application:
            raise Http404
        if not application_service.recruiter_owns_application(application, request.user):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = InterviewScheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        scheduled_at = serializer.validated_data['scheduled_at']
        recruiter_notes = serializer.validated_data.get('recruiter_notes', '')

        interview = application_handler.handle_schedule_interview(request.user, application, scheduled_at, recruiter_notes)

        return Response(InterviewSerializer(interview).data, status=status.HTTP_201_CREATED)


class InterviewDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, application_id):
        application = application_service.get_application(application_id)
        if not application:
            raise Http404
        interview = application_service.get_interview(application)
        if not interview:
            raise Http404

        if not application_service.user_can_access_application(request.user, application):
            return Response({'error': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        return Response(InterviewSerializer(interview).data)


class SeekerApplicationForRecruiterView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, seeker_id):
        if not application_service.request_user_is_recruiter(request.user):
            return Response({'error': 'Only recruiters can view candidate applications.'}, status=status.HTTP_403_FORBIDDEN)
        
        from applications.models.application import Application
        apps = Application.objects.filter(seeker_id=seeker_id, recruiter_id=request.user.id)
        return Response(ApplicationSerializer(apps, many=True).data)

