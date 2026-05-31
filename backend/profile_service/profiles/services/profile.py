from profiles.dao import profile as profile_dao

def get_seeker_profile(user_id):
    return profile_dao.get_seeker_profile(user_id)

def get_seeker_profile_by_id(seeker_id):
    return profile_dao.get_seeker_profile_by_id_or_user_id(seeker_id)

def create_seeker_profile(user_id, data):
    if profile_dao.get_seeker_profile(user_id):
        return None, "Profile already exists."
    profile = profile_dao.create_seeker_profile(user_id, data)
    return profile, None

def update_seeker_profile(user_id, data):
    profile = profile_dao.get_seeker_profile(user_id)
    if not profile:
        return None, "Profile not found."
    profile = profile_dao.update_seeker_profile(profile, data)
    return profile, None

def get_recruiter_profile(user_id):
    return profile_dao.get_recruiter_profile(user_id)

def create_recruiter_profile(user_id, data):
    if profile_dao.get_recruiter_profile(user_id):
        return None, "Profile already exists."
    profile = profile_dao.create_recruiter_profile(user_id, data)
    return profile, None

def update_recruiter_profile(user_id, data):
    profile = profile_dao.get_recruiter_profile(user_id)
    if not profile:
        return None, "Profile not found."
    profile = profile_dao.update_recruiter_profile(profile, data)
    return profile, None

def get_all_skills():
    return profile_dao.get_all_skills()

def get_seeker_skills(user_id):
    profile = profile_dao.get_seeker_profile(user_id)
    if not profile:
        return None, "Seeker profile not found."
    return profile.skills.all(), None

def add_seeker_skill(user_id, skill_name, years_of_experience):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return None, False, "Seeker profile not found."
    skill = profile_dao.get_or_create_skill(skill_name.strip())
    obj, created = profile_dao.get_or_create_seeker_skill(seeker, skill, years_of_experience)
    return obj, created, None

def get_seeker_experiences(user_id):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return None, "Seeker profile not found."
    return seeker.experiences.all(), None

def add_experience(user_id, data):
    seeker = profile_dao.get_seeker_profile(user_id)
    if not seeker:
        return None, "Seeker profile not found."
    exp = profile_dao.create_experience(seeker, data)
    return exp, None