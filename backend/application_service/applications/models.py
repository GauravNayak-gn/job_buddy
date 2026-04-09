import uuid
from datetime import timedelta
from django.db import models
from django.utils import timezone


class Application(models.Model):
    STAGE_APPLIED = 'applied'
    STAGE_SCREENING = 'screening'
    STAGE_INTERVIEW = 'interview_scheduled'
    STAGE_OFFERED = 'offered'
    STAGE_REJECTED = 'rejected'

    STAGE_CHOICES = [
        (STAGE_APPLIED, 'Applied'),
        (STAGE_SCREENING, 'Screening'),
        (STAGE_INTERVIEW, 'Interview Scheduled'),
        (STAGE_OFFERED, 'Offered'),
        (STAGE_REJECTED, 'Rejected'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    job_id = models.UUIDField()
    seeker_id = models.UUIDField()
    seeker_email = models.EmailField(blank=True)
    recruiter_id = models.UUIDField(null=True, blank=True)
    job_title = models.CharField(max_length=200, blank=True)
    resume_id = models.UUIDField()
    cover_letter = models.TextField(blank=True)
    current_stage = models.CharField(max_length=30, choices=STAGE_CHOICES, default=STAGE_APPLIED)
    is_withdrawn = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'applications'
        constraints = [
            models.UniqueConstraint(fields=['job_id', 'seeker_id'], name='uniq_job_seeker_application')
        ]


class ApplicationStageHistory(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(Application, on_delete=models.CASCADE, related_name='stage_history')
    old_stage = models.CharField(max_length=30, blank=True)
    new_stage = models.CharField(max_length=30)
    changed_by = models.UUIDField()
    note = models.TextField(blank=True)
    changed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'application_stage_history'


class Interview(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.OneToOneField(Application, on_delete=models.CASCADE, related_name='interview')
    scheduled_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    jitsi_room_id = models.CharField(max_length=100)
    jitsi_link = models.URLField(max_length=300)
    is_expired = models.BooleanField(default=False)
    recruiter_notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'interviews'

    def save(self, *args, **kwargs):
        if self.scheduled_at and not self.expires_at:
            self.expires_at = self.scheduled_at + timedelta(hours=2)
        if self.expires_at and self.expires_at <= timezone.now():
            self.is_expired = True
        super().save(*args, **kwargs)
