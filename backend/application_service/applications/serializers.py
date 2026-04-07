from rest_framework import serializers
from .models import Application, ApplicationStageHistory, Interview


class ApplicationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Application
        fields = '__all__'
        read_only_fields = ['id', 'seeker_id', 'current_stage', 'is_withdrawn', 'created_at', 'updated_at']


class ApplicationStageHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ApplicationStageHistory
        fields = '__all__'
        read_only_fields = ['id', 'changed_at']


class StageUpdateSerializer(serializers.Serializer):
    new_stage = serializers.ChoiceField(choices=[choice[0] for choice in Application.STAGE_CHOICES])
    note = serializers.CharField(required=False, allow_blank=True)


class InterviewSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interview
        fields = '__all__'
        read_only_fields = ['id', 'jitsi_room_id', 'jitsi_link', 'is_expired', 'created_at', 'updated_at']


class InterviewScheduleSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()
    recruiter_notes = serializers.CharField(required=False, allow_blank=True)
