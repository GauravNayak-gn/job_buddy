from profiles.models import Resume

def get_resume_by_id(resume_id, seeker=None):
    qs = Resume.objects.filter(id=resume_id)
    if seeker:
        qs = qs.filter(seeker=seeker)
    return qs.first()

def create_resume(seeker, resume_title, local_path, file_size_bytes, is_primary, raw_text, parsing_status):
    return Resume.objects.create(
        seeker=seeker,
        resume_title=resume_title,
        local_path=local_path,
        file_size_bytes=file_size_bytes,
        is_primary=is_primary,
        raw_text=raw_text,
        parsing_status=parsing_status
    )

def delete_resume(resume):
    resume.delete()

def set_resume_primary(seeker, resume):
    seeker.resumes.exclude(id=resume.id).update(is_primary=False)
    resume.is_primary = True
    resume.save()
    return resume