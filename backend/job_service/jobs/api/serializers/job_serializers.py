from rest_framework import serializers
from jobs.models import Job, JobCategory, JobSkill

class JobSkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobSkill
        fields = ['id', 'skill_name', 'is_required']

class JobCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = JobCategory
        fields = ['id', 'name']

class JobSerializer(serializers.ModelSerializer):
    skills = JobSkillSerializer(many=True, required=False)

    class Meta:
        model = Job
        exclude = ['total_applications']
        read_only_fields = ['slug', 'status', 'is_archived', 'archived_at', 'recruiter_id']
