from django.contrib import admin
from .models import Application, ApplicationStageHistory, Interview

admin.site.register(Application)
admin.site.register(ApplicationStageHistory)
admin.site.register(Interview)
