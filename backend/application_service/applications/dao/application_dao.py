from applications.models import Application, ApplicationStageHistory, Interview

def get_application(application_id):
    return Application.objects.filter(id=application_id).first()

def create_application(**kwargs):
    return Application.objects.create(**kwargs)

def get_seeker_applications(seeker_id, stage=None):
    qs = Application.objects.filter(seeker_id=seeker_id)
    if stage:
        qs = qs.filter(current_stage=stage)
    return qs.order_by('-created_at')

def get_recruiter_job_applications(job_id, recruiter_id, sort_by='-created_at'):
    return Application.objects.filter(
        job_id=job_id, recruiter_id=recruiter_id, is_withdrawn=False
    ).order_by(sort_by)

def has_seeker_applied(job_id, seeker_id):
    return Application.objects.filter(job_id=job_id, seeker_id=seeker_id).exists()

def withdraw_application(application):
    application.is_withdrawn = True
    application.save(update_fields=['is_withdrawn', 'updated_at'])

def update_stage(application, new_stage):
    application.current_stage = new_stage
    application.save(update_fields=['current_stage', 'updated_at'])

def create_stage_history(application, old_stage, new_stage, changed_by, note=''):
    return ApplicationStageHistory.objects.create(
        application=application,
        old_stage=old_stage,
        new_stage=new_stage,
        changed_by=changed_by,
        note=note
    )

def get_stage_history(application):
    return application.stage_history.order_by('-changed_at')

def create_or_update_interview(application, defaults):
    interview, _ = Interview.objects.update_or_create(
        application=application,
        defaults=defaults
    )
    return interview

def get_interview(application):
    return Interview.objects.filter(application=application).first()
