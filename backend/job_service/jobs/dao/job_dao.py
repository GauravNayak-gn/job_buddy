from jobs.models import Job, JobCategory, JobSkill
from django.utils.text import slugify
import uuid

def get_job_categories():
    return JobCategory.objects.all()

def get_active_jobs(location_type=None, category=None, search=None):
    jobs = Job.objects.filter(status='published', is_archived=False).select_related('category').prefetch_related('skills')
    if location_type:
        jobs = jobs.filter(location_type=location_type)
    if category:
        jobs = jobs.filter(category__name__icontains=category)
    if search:
        jobs = jobs.filter(title__icontains=search) | jobs.filter(description__icontains=search)
    return jobs.order_by('-created_at')

def get_recruiter_jobs(recruiter_id):
    return Job.objects.filter(recruiter_id=recruiter_id).order_by('-created_at')

def get_job_by_id(job_id):
    return Job.objects.get(id=job_id)

def get_job_by_id_and_recruiter(job_id, recruiter_id):
    return Job.objects.get(id=job_id, recruiter_id=recruiter_id)

def create_job(data, skills_data=None):
    base_slug = slugify(data.get('title', ''))
    data['slug'] = f"{base_slug}-{str(uuid.uuid4())[:8]}"
    job = Job.objects.create(**data)
    if skills_data:
        for skill in skills_data:
            JobSkill.objects.create(job=job, **skill)
    return job

def update_job(job, data, skills_data=None):
    for attr, value in data.items():
        setattr(job, attr, value)
    job.save()
    if skills_data is not None:
        job.skills.all().delete()
        for skill in skills_data:
            JobSkill.objects.create(job=job, **skill)
    return job

def update_job_status(job, status):
    job.status = status
    job.save(update_fields=['status', 'updated_at'])

def archive_job(job):
    job.archive()
    job.save(update_fields=['is_archived', 'archived_at', 'status', 'updated_at'])

def restore_job(job):
    job.restore()
    job.save(update_fields=['is_archived', 'archived_at', 'updated_at'])
