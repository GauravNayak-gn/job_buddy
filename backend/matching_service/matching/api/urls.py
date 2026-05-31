from django.urls import path
from .views.health import HealthView
from .views.embeddings import UpsertResumeEmbeddingView, UpsertJobEmbeddingView
from .views.matching import JobsForSeekerView, SeekersForJobView

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('embed/resume/', UpsertResumeEmbeddingView.as_view()),
    path('embed/job/', UpsertJobEmbeddingView.as_view()),
    path('jobs-for-seeker/<uuid:seeker_id>/', JobsForSeekerView.as_view()),
    path('seekers-for-job/<uuid:job_id>/', SeekersForJobView.as_view()),
]
