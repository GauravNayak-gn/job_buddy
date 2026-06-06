from datetime import timedelta
import uuid
from django.utils import timezone
from applications.dao import application_dao
from applications.tasks.events import (
    publish_application_received,
    publish_application_stage_changed,
    publish_interview_scheduled
)
from applications.services.job_service_client import fetch_job_details
from applications.models.application import Application

def handle_apply(user, job_id, resume_id, cover_letter='', screening_answers=None):
    seeker_id = user.id
    job_details = fetch_job_details(job_id)
    
    if not job_details:
        raise ValueError("Job not found.")
    if job_details.get('status') != 'published' or job_details.get('is_archived'):
        raise ValueError("This job is not accepting new applications.")
        
    if application_dao.has_seeker_applied(job_id, seeker_id):
        raise ValueError("Already applied for this job.")
        
    seeker_email = getattr(user, 'email', '')
    recruiter_id = job_details.get('recruiter_id')
    job_title = job_details.get('title', '')
    
    if screening_answers is None:
        screening_answers = []

    application = application_dao.create_application(
        job_id=job_id,
        seeker_id=seeker_id,
        seeker_email=seeker_email,
        recruiter_id=recruiter_id,
        job_title=job_title,
        resume_id=resume_id,
        cover_letter=cover_letter,
        screening_answers=screening_answers
    )
    
    application_dao.create_stage_history(
        application=application,
        old_stage='',
        new_stage=application.current_stage,
        changed_by=seeker_id,
        note='Application submitted'
    )
    
    publish_application_received(
        application.id,
        application.recruiter_id,
        application.job_title,
        application.seeker_email
    )
    return application


def handle_update_stage(user, application, new_stage, note=''):
    old_stage = application.current_stage
    application_dao.update_stage(application, new_stage)
    
    history = application_dao.create_stage_history(
        application=application,
        old_stage=old_stage,
        new_stage=new_stage,
        changed_by=user.id,
        note=note
    )
    
    publish_application_stage_changed(application.id, application.seeker_id, new_stage)
    return application, history


def handle_schedule_interview(user, application, scheduled_at, recruiter_notes=''):
    room_id = f"jobportal-{uuid.uuid4()}"
    link = f"https://meet.jit.si/{room_id}"
    expires_at = scheduled_at + timedelta(hours=2)
    
    defaults = {
        'scheduled_at': scheduled_at,
        'expires_at': expires_at,
        'jitsi_room_id': room_id,
        'jitsi_link': link,
        'recruiter_notes': recruiter_notes,
        'is_expired': expires_at <= timezone.now(),
    }
    
    interview = application_dao.create_or_update_interview(application, defaults)
    
    old_stage = application.current_stage
    application_dao.update_stage(application, Application.STAGE_INTERVIEW)
    
    application_dao.create_stage_history(
        application=application,
        old_stage=old_stage,
        new_stage=Application.STAGE_INTERVIEW,
        changed_by=user.id,
        note='Interview scheduled'
    )
    
    publish_application_stage_changed(application.id, application.seeker_id, Application.STAGE_INTERVIEW)
    publish_interview_scheduled(
        application.id,
        application.seeker_id,
        scheduled_at,
        link,
        application.seeker_email,
        application.job_title
    )
    
    return interview
