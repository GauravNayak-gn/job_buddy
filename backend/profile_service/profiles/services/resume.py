from profiles.dao import resume as resume_dao
from profiles.dao import profile as profile_dao

def get_seeker_resumes(user_id):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return None, "Seeker profile not found."
    return seeker.resumes.all(), None

def get_resume(resume_id, user_id=None):
    if user_id:
        seeker = profile_dao.get_seeker_profile(user_id)
        if not seeker:
            return None, "Seeker profile not found."
        resume = resume_dao.get_resume_by_id(resume_id, seeker=seeker)
    else:
        resume = resume_dao.get_resume_by_id(resume_id)
    if not resume:
        return None, "Resume not found."
    return resume, None

def update_resume_primary_status(user_id, resume_id, is_primary):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return None, "Seeker profile not found."
    resume = resume_dao.get_resume_by_id(resume_id, seeker=seeker)
    if not resume:
        return None, "Resume not found."
    
    if is_primary:
        resume = resume_dao.set_resume_primary(seeker, resume)
    else:
        resume.is_primary = False
        resume.save()
    return resume, None

def check_resume_access(user_id, resume_id):
    resume, err = get_resume(resume_id)
    if err:
        return None, err
    
    is_owner = str(resume.seeker.user_id) == str(user_id)
    is_recruiter = profile_dao.get_recruiter_profile(user_id) is not None
    
    if not (is_owner or is_recruiter):
        return None, "Forbidden. You do not have permission to access this resume."
    return resume, None