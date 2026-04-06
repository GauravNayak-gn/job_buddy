from rest_framework import serializers
from .models import SeekerProfile, RecruiterProfile, Skill, SeekerSkill, Experience, Resume


class SeekerProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeekerProfile
        exclude = ['user_id']


class RecruiterProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecruiterProfile
        exclude = ['user_id']


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = ['id', 'name']


class SeekerSkillSerializer(serializers.ModelSerializer):
    skill_name = serializers.CharField(source='skill.name', read_only=True)

    class Meta:
        model = SeekerSkill
        fields = ['id', 'skill', 'skill_name', 'years_of_experience']


class ExperienceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Experience
        exclude = ['seeker']


class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ['id', 'resume_title', 'is_primary', 'parsing_status', 'file_size_bytes', 'created_at']
