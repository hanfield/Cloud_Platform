from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()


class SystemMetrics(models.Model):
    """系统指标快照"""
    cpu_usage = models.FloatField('CPU使用率', default=0.0)
    memory_usage = models.FloatField('内存使用率', default=0.0)
    disk_usage = models.FloatField('磁盘使用率', default=0.0)
    timestamp = models.DateTimeField('记录时间', auto_now_add=True)

    class Meta:
        db_table = 'system_metrics'
        verbose_name = '系统指标'
        verbose_name_plural = verbose_name
        ordering = ['-timestamp']

    def __str__(self):
        return f'系统指标 {self.timestamp.strftime("%Y-%m-%d %H:%M:%S")}'


class ActivityLog(models.Model):
    """系统活动日志"""
    ACTION_TYPES = (
        ('login', '用户登录'),
        ('logout', '用户登出'),
        ('create', '创建'),
        ('update', '更新'),
        ('delete', '删除'),
        ('system', '系统操作'),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='用户'
    )
    action_type = models.CharField('操作类型', max_length=20, choices=ACTION_TYPES)
    description = models.TextField('描述')
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    created_at = models.DateTimeField('创建时间', auto_now_add=True)

    class Meta:
        db_table = 'activity_logs'
        verbose_name = '活动日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.get_action_type_display()} - {self.description}'

    @classmethod
    def log_activity(cls, action_type, description, user=None, ip_address=None):
        """记录活动"""
        return cls.objects.create(
            action_type=action_type,
            description=description,
            user=user,
            ip_address=ip_address
        )
