from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name='ResumeEmbedding',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('resume_id', models.UUIDField(unique=True)),
                ('seeker_id', models.UUIDField(db_index=True)),
                ('embedding', models.TextField()),
                ('model_version', models.CharField(default='all-MiniLM-L6-v2', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'resume_embeddings'},
        ),
        migrations.CreateModel(
            name='JobEmbedding',
            fields=[
                ('id', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('job_id', models.UUIDField(unique=True)),
                ('embedding', models.TextField()),
                ('model_version', models.CharField(default='all-MiniLM-L6-v2', max_length=50)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'db_table': 'job_embeddings'},
        ),
    ]
