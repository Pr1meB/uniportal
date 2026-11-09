from django.contrib import admin

from apps.results.models import Result, ResultSheet

admin.site.register(ResultSheet)
admin.site.register(Result)
