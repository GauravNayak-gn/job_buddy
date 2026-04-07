from rest_framework import serializers
from .models import JobEmbedding, ResumeEmbedding


class ResumeEmbeddingSerializer(serializers.ModelSerializer):
    class Meta:
        model = ResumeEmbedding
        fields = '__all__'


class JobEmbeddingSerializer(serializers.ModelSerializer):
    class Meta:
        model = JobEmbedding
        fields = '__all__'
