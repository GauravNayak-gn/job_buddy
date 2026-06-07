from django.urls import path
from profiles.api.views.profile import (
    HealthView, SeekerProfileView, RecruiterProfileView,
    SkillListView, SeekerSkillView, ExperienceView, SeekerProfileByIdView,
    RecruiterProfileByIdView
)
from profiles.api.views.resume import (
    ResumeUploadView, ResumeDetailView, ResumeURLView, ResumeDownloadView
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('seeker/', SeekerProfileView.as_view()),
    path('recruiter/', RecruiterProfileView.as_view()),
    path('skills/', SkillListView.as_view()),
    path('seeker/skills/', SeekerSkillView.as_view()),
    path('seeker/experience/', ExperienceView.as_view()),
    path('seeker/resumes/', ResumeUploadView.as_view()),
    path('seeker/resumes/<uuid:resume_id>/', ResumeDetailView.as_view()),
    path('seeker/resumes/<uuid:resume_id>/url/', ResumeURLView.as_view()),
    path('seeker/resumes/<uuid:resume_id>/download/', ResumeDownloadView.as_view()),
    path('seeker/<uuid:seeker_id>/', SeekerProfileByIdView.as_view()),
    path('recruiter/<uuid:recruiter_id>/', RecruiterProfileByIdView.as_view()),
]