from django.apps import AppConfig


class MonitoringConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.monitoring'
    verbose_name = '系统监控'

    def ready(self):
        import apps.monitoring.signals
