from applications.dao import application_dao

def get_application(application_id):
    return application_dao.get_application(application_id)

def get_seeker_applications(seeker_id, stage=None):
    return application_dao.get_seeker_applications(seeker_id, stage)

def get_recruiter_job_applications(job_id, recruiter_id, sort_by='-created_at'):
    return application_dao.get_recruiter_job_applications(job_id, recruiter_id, sort_by)

def withdraw_application(application, user):
    if str(application.seeker_id) != str(user.id):
        raise PermissionError("Not authorized to withdraw this application.")
    application_dao.withdraw_application(application)

def get_stage_history(application):
    return application_dao.get_stage_history(application)

def get_interview(application):
    return application_dao.get_interview(application)

def request_user_is_seeker(user):
    return getattr(user, 'role', '') == 'seeker'

def request_user_is_recruiter(user):
    return getattr(user, 'role', '') == 'recruiter'

def recruiter_owns_application(application, user):
    return request_user_is_recruiter(user) and str(application.recruiter_id) == str(user.id)

def user_can_access_application(user, application):
    if request_user_is_seeker(user):
        return str(application.seeker_id) == str(user.id)
    if request_user_is_recruiter(user):
        return recruiter_owns_application(application, user)
    return False
