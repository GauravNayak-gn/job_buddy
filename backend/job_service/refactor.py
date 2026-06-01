import os
import shutil

base_dir = "/media/gaurav/Local Disk/MWA/Job-buddy/backend/job_service/jobs"

dirs_to_create = [
    "api",
    "api/views",
    "api/serializers",
    "services",
    "handlers",
    "dao",
    "models",
    "tasks"
]

for d in dirs_to_create:
    os.makedirs(os.path.join(base_dir, d), exist_ok=True)
    with open(os.path.join(base_dir, d, "__init__.py"), "w") as f:
        pass

if os.path.exists(os.path.join(base_dir, "models.py")):
    shutil.move(os.path.join(base_dir, "models.py"), os.path.join(base_dir, "models", "job.py"))
    with open(os.path.join(base_dir, "models", "__init__.py"), "w") as f:
        f.write("from .job import Job, JobCategory, JobSkill\n")
