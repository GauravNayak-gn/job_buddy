from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Application',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('job_id', models.UUIDField()),
                ('seeker_id', models.UUIDField()),
                ('recruiter_id', models.UUIDField(blank=True, null=True)),
                ('resume_id', models.UUIDField()),
                ('cover_letter', models.TextField(blank=True)),
                ('current_stage', models.CharField(choices=[('applied', 'Applied'), ('screening', 'Screening'), ('interview_scheduled', 'Interview Scheduled'), ('offered', 'Offered'), ('rejected', 'Rejected')], default='applied', max_length=30)),
                ('is_withdrawn', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'applications'},
        ),
        migrations.CreateModel(
            name='ApplicationStageHistory',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('old_stage', models.CharField(blank=True, max_length=30)),
                ('new_stage', models.CharField(max_length=30)),
                ('changed_by', models.UUIDField()),
                ('note', models.TextField(blank=True)),
                ('changed_at', models.DateTimeField(auto_now_add=True)),
                ('application', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='stage_history', to='applications.application')),
            ],
            options={'db_table': 'application_stage_history'},
        ),
        migrations.CreateModel(
            name='Interview',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('scheduled_at', models.DateTimeField()),
                ('expires_at', models.DateTimeField()),
                ('jitsi_room_id', models.CharField(max_length=100)),
                ('jitsi_link', models.URLField(max_length=300)),
                ('is_expired', models.BooleanField(default=False)),
                ('recruiter_notes', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('application', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name='interview', to='applications.application')),
            ],
            options={'db_table': 'interviews'},
        ),
        migrations.AddConstraint(
            model_name='application',
            constraint=models.UniqueConstraint(fields=('job_id', 'seeker_id'), name='uniq_job_seeker_application'),
        ),
    ]
