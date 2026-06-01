from profiles.dao import profile as profile_dao
from profiles.dao import resume as resume_dao
from profiles.utils import upload_to_s3, extract_text_from_pdf, publish_resume_uploaded, publish_resume_deleted
from django.core.files.storage import default_storage

def handle_resume_upload(user_id, file, resume_title):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return None, "Seeker profile not found."
    
    raw_text = extract_text_from_pdf(file)
    file.seek(0)

    try:
        local_path = upload_to_s3(file, seeker.id)
        parsing_status = 'success'
    except Exception as e:
        return None, f"Upload failed: {str(e)}"

    is_primary = not seeker.resumes.filter(is_primary=True).exists()

    resume = resume_dao.create_resume(
        seeker=seeker,
        resume_title=resume_title or file.name,
        local_path=local_path,
        file_size_bytes=file.size,
        is_primary=is_primary,
        raw_text=raw_text,
        parsing_status=parsing_status if raw_text else 'failed'
    )

    publish_resume_uploaded(resume.id, seeker.user_id, raw_text)
    return resume, None

def handle_resume_deletion(user_id, resume_id):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return "Seeker profile not found."
    
    resume = resume_dao.get_resume_by_id(resume_id, seeker=seeker)
    if not resume:
        return "Resume not found."
    
    publish_resume_deleted(resume.id, seeker.user_id)
    
    if default_storage.exists(resume.local_path):
        default_storage.delete(resume.local_path)
        
    resume_dao.delete_resume(resume)
    return None