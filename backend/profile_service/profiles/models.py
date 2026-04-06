import uuid
from django.db import models


class SeekerProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(unique=True)
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    phone = models.CharField(max_length=20, blank=True)
    current_title = models.CharField(max_length=150, blank=True)
    summary = models.TextField(blank=True)
    github_url = models.URLField(blank=True)
    linkedin_url = models.URLField(blank=True)
    profile_picture_key = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'seeker_profiles'


class RecruiterProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user_id = models.UUIDField(unique=True)
    company_name = models.CharField(max_length=200)
    company_size = models.CharField(max_length=50, blank=True)
    industry = models.CharField(max_length=100, blank=True)
    hq_location = models.CharField(max_length=200, blank=True)
    website_url = models.URLField(blank=True)
    company_logo_key = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'recruiter_profiles'


class Skill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'skills'


class SeekerSkill(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker = models.ForeignKey(SeekerProfile, on_delete=models.CASCADE, related_name='skills')
    skill = models.ForeignKey(Skill, on_delete=models.CASCADE)
    years_of_experience = models.SmallIntegerField(default=0)

    class Meta:
        db_table = 'seeker_skills'
        unique_together = ('seeker', 'skill')


class Experience(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker = models.ForeignKey(SeekerProfile, on_delete=models.CASCADE, related_name='experiences')
    company_name = models.CharField(max_length=200)
    role_title = models.CharField(max_length=150)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'experiences'


class Resume(models.Model):
    PARSING_STATUS = [('pending', 'Pending'), ('success', 'Success'), ('failed', 'Failed')]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    seeker = models.ForeignKey(SeekerProfile, on_delete=models.CASCADE, related_name='resumes')
    resume_title = models.CharField(max_length=200)
    s3_key = models.CharField(max_length=500)
    file_size_bytes = models.IntegerField(null=True)
    is_primary = models.BooleanField(default=False)
    raw_text = models.TextField(blank=True)
    parsing_status = models.CharField(max_length=20, choices=PARSING_STATUS, default='pending')
    parsing_error = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'resumes'
