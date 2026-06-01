from profiles.models import SeekerProfile, RecruiterProfile, Skill, SeekerSkill, Experience

def get_seeker_profile(user_id):
    return SeekerProfile.objects.filter(user_id=user_id).first()

def get_seeker_profile_by_id_or_user_id(seeker_id):
    profile = SeekerProfile.objects.filter(id=seeker_id).first()
    if not profile:
        profile = SeekerProfile.objects.filter(user_id=seeker_id).first()
    return profile

def create_seeker_profile(user_id, data):
    return SeekerProfile.objects.create(user_id=user_id, **data)

def update_seeker_profile(profile, data):
    for key, value in data.items():
        setattr(profile, key, value)
    profile.save()
    return profile

def get_recruiter_profile(user_id):
    return RecruiterProfile.objects.filter(user_id=user_id).first()

def create_recruiter_profile(user_id, data):
    return RecruiterProfile.objects.create(user_id=user_id, **data)

def update_recruiter_profile(profile, data):
    for key, value in data.items():
        setattr(profile, key, value)
    profile.save()
    return profile

def get_all_skills():
    return Skill.objects.all()

def get_or_create_skill(name):
    skill, created = Skill.objects.get_or_create(name=name)
    return skill

def get_or_create_seeker_skill(seeker, skill, years_of_experience):
    return SeekerSkill.objects.get_or_create(
        seeker=seeker, skill=skill,
        defaults={'years_of_experience': years_of_experience}
    )

def create_experience(seeker, data):
    return Experience.objects.create(seeker=seeker, **data)