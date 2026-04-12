from rest_framework import serializers
from .models import Job, JobCategory, JobSkill
from django.utils.text import slugify
import uuid


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

    def create(self, validated_data):
        skills_data = validated_data.pop('skills', [])
        base_slug = slugify(validated_data['title'])
        validated_data['slug'] = f"{base_slug}-{str(uuid.uuid4())[:8]}"
        job = Job.objects.create(**validated_data)
        for skill in skills_data:
            JobSkill.objects.create(job=job, **skill)
        return job

    def update(self, instance, validated_data):
        skills_data = validated_data.pop('skills', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if skills_data is not None:
            instance.skills.all().delete()
            for skill in skills_data:
                JobSkill.objects.create(job=instance, **skill)
        return instance
