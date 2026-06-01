from django.urls import path
from applications.api.views.application_views import (
    ApplicationDetailView,
    ApplyView,
    HealthView,
    InterviewDetailView,
    JobApplicationListView,
    MyApplicationListView,
    ScheduleInterviewView,
    StageHistoryView,
    UpdateStageView,
    WithdrawApplicationView,
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('apply/', ApplyView.as_view()),
    path('my/', MyApplicationListView.as_view()),
    path('job/<uuid:job_id>/', JobApplicationListView.as_view()),
    path('<uuid:application_id>/', ApplicationDetailView.as_view()),
    path('<uuid:application_id>/withdraw/', WithdrawApplicationView.as_view()),
    path('<uuid:application_id>/stage/', UpdateStageView.as_view()),
    path('<uuid:application_id>/history/', StageHistoryView.as_view()),
    path('<uuid:application_id>/schedule-interview/', ScheduleInterviewView.as_view()),
    path('<uuid:application_id>/interview/', InterviewDetailView.as_view()),
]
