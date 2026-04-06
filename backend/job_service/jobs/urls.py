from django.urls import path
from .views import (
    HealthView, JobListView, JobCreateView, JobDetailView,
    JobPublishView, JobCloseView, JobCategoryListView, RecruiterJobListView
)

urlpatterns = [
    path('health/', HealthView.as_view()),
    path('', JobListView.as_view()),
    path('create/', JobCreateView.as_view()),
    path('my/', RecruiterJobListView.as_view()),
    path('categories/', JobCategoryListView.as_view()),
    path('<uuid:job_id>/', JobDetailView.as_view()),
    path('<uuid:job_id>/publish/', JobPublishView.as_view()),
    path('<uuid:job_id>/close/', JobCloseView.as_view()),
]
