from rest_framework import serializers
from profiles.models import Resume

class ResumeSerializer(serializers.ModelSerializer):
    class Meta:
        model = Resume
        fields = ['id', 'resume_title', 'is_primary', 'parsing_status', 'file_size_bytes', 'created_at']