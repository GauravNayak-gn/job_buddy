from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='Notification',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('user_id', models.UUIDField(db_index=True)),
                ('notification_type', models.CharField(choices=[('application.stage_changed', 'Application Stage Changed'), ('interview.scheduled', 'Interview Scheduled'), ('user.registered', 'User Registered'), ('system', 'System')], default='system', max_length=64)),
                ('title', models.CharField(max_length=180)),
                ('body', models.TextField(blank=True)),
                ('payload', models.JSONField(blank=True, default=dict)),
                ('is_read', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('read_at', models.DateTimeField(blank=True, null=True)),
            ],
            options={'db_table': 'notifications', 'ordering': ['-created_at']},
        ),
    ]
