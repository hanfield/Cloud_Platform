"""
Celery配置文件
"""

import os
from celery import Celery
from celery.schedules import crontab

# 设置Django设置模块
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'cloud_platform.settings')

# 创建Celery应用
app = Celery('cloud_platform')

# 从Django设置中加载配置，使用CELERY命名空间
app.config_from_object('django.conf:settings', namespace='CELERY')

# 自动发现所有已注册app中的tasks.py
app.autodiscover_tasks()

# 定时任务配置
app.conf.beat_schedule = {
    # 每日计费任务 - 每天凌晨0:10执行
    'daily-billing': {
        'task': 'apps.information_systems.tasks.create_daily_billing_records',
        'schedule': crontab(hour=0, minute=10),
        'options': {'queue': 'billing'}
    },
    # 资源变更检测任务 - 每小时执行一次
    'detect-resource-changes': {
        'task': 'apps.information_systems.tasks.detect_resource_changes',
        'schedule': crontab(minute=0),  # 每小时的0分执行
        'options': {'queue': 'monitoring'}
    },
    # 虚拟机状态同步 - 每5分钟执行一次
    'sync-vm-status': {
        'task': 'apps.information_systems.tasks.sync_vm_status',
        'schedule': crontab(minute='*/5'),  # 每5分钟执行
        'options': {'queue': 'monitoring'}
    },
}

# Celery任务配置
app.conf.task_routes = {
    'apps.information_systems.tasks.*': {'queue': 'billing'},
}

# 时区设置
app.conf.timezone = 'Asia/Shanghai'
app.conf.enable_utc = False


@app.task(bind=True)
def debug_task(self):
    """调试任务"""
    print(f'Request: {self.request!r}')