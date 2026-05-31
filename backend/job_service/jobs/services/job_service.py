from jobs.dao import job_dao
from jobs.tasks.kafka_tasks import publish_job_published_event
from django.core.cache import cache

def clear_jobs_cache():
    cache.delete_pattern("jobs_list_*")

def publish_job(job):
    if job.is_archived:
        raise ValueError("Restore the job before publishing it.")
    job_dao.update_job_status(job, 'published')
    publish_job_published_event(job.id, job.description)
    clear_jobs_cache()

def close_job(job):
    job_dao.update_job_status(job, 'closed')
    clear_jobs_cache()

def archive_job(job):
    job_dao.archive_job(job)
    clear_jobs_cache()

def restore_job(job):
    job_dao.restore_job(job)
    clear_jobs_cache()

def create_job(data, skills_data, recruiter_id):
    data['recruiter_id'] = recruiter_id
    job = job_dao.create_job(data, skills_data)
    return job

def update_job(job, data, skills_data=None):
    if job.is_archived:
        raise ValueError("Archived jobs cannot be edited until restored.")
    job = job_dao.update_job(job, data, skills_data)
    clear_jobs_cache()
    return job

def get_job_for_detail(job_id, user_id=None):
    job = job_dao.get_job_by_id(job_id)
    if job.is_archived and str(job.recruiter_id) != str(user_id):
        raise ValueError("Job not found.")
    return job
