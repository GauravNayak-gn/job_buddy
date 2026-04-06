import uuid
from django.db import models


class JobCategory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'job_categories'


class Job(models.Model):
    STATUS_CHOICES = [('draft', 'Draft'), ('published', 'Published'), ('closed', 'Closed')]
    LOCATION_CHOICES = [('remote', 'Remote'), ('hybrid', 'Hybrid'), ('onsite', 'Onsite')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    recruiter_id = models.UUIDField()
    category = models.ForeignKey(JobCategory, on_delete=models.SET_NULL, null=True, blank=True)
    title = models.CharField(max_length=200)
    slug = models.SlugField(max_length=220, unique=True)
    description = models.TextField()
    location_type = models.CharField(max_length=20, choices=LOCATION_CHOICES)
    location_city = models.CharField(max_length=100, blank=True)
    salary_min = models.IntegerField(null=True, blank=True)
    salary_max = models.IntegerField(null=True, blank=True)
    currency = models.CharField(max_length=10, default='INR')
    experience_required = models.CharField(max_length=50, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    total_applications = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'jobs'


class JobSkill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job = models.ForeignKey(Job, on_delete=models.CASCADE, related_name='skills')
    skill_name = models.CharField(max_length=100)
    is_required = models.BooleanField(default=True)

    class Meta:
        db_table = 'job_skills'
