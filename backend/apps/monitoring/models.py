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
    """系统活动日志（审计日志）"""
    ACTION_TYPES = (
        ('login', '用户登录'),
        ('logout', '用户登出'),
        ('create', '创建'),
        ('update', '更新'),
        ('delete', '删除'),
        ('start', '启动'),
        ('stop', '停止'),
        ('restart', '重启'),
        ('resize', '调整配置'),
        ('snapshot', '创建快照'),
        ('restore', '恢复快照'),
        ('upload', '上传'),
        ('download', '下载'),
        ('read', '查看'),
        ('execute', '执行'),
        ('system', '系统操作'),
    )
    
    RESOURCE_TYPES = (
        ('vm', '虚拟机'),
        ('image', '镜像'),
        ('network', '网络'),
        ('snapshot', '快照'),
        ('tenant', '租户'),
        ('user', '用户'),
        ('system', '信息系统'),
        ('alert_rule', '告警规则'),
        ('security_group', '安全组'),
        ('floating_ip', '浮动IP'),
        ('flavor', '规格'),
        ('contract', '合同'),
        ('order', '订单'),
        ('other', '其他'),
    )
    
    STATUS_CHOICES = (
        ('success', '成功'),
        ('failed', '失败'),
        ('partial', '部分成功'),
    )

    # 基础信息
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        verbose_name='操作用户'
    )
    action_type = models.CharField('操作类型', max_length=20, choices=ACTION_TYPES)
    description = models.TextField('操作描述')
    
    # 资源信息（新增）
    resource_type = models.CharField('资源类型', max_length=20, choices=RESOURCE_TYPES, default='other')
    resource_id = models.CharField('资源ID', max_length=255, null=True, blank=True)
    resource_name = models.CharField('资源名称', max_length=255, null=True, blank=True)
    
    # 变更详情（新增）
    changes = models.JSONField('变更详情', null=True, blank=True, help_text='记录变更前后的值')
    # 例如: {"cpu_cores": {"old": 2, "new": 4}, "memory_gb": {"old": 4, "new": 8}}
    
    # 请求元数据（新增）
    ip_address = models.GenericIPAddressField('IP地址', null=True, blank=True)
    user_agent = models.CharField('用户代理', max_length=500, null=True, blank=True)
    request_path = models.CharField('请求路径', max_length=500, null=True, blank=True)
    request_method = models.CharField('请求方法', max_length=10, null=True, blank=True)
    
    # 操作结果（新增）
    status = models.CharField('状态', max_length=20, choices=STATUS_CHOICES, default='success')
    error_message = models.TextField('错误信息', null=True, blank=True)
    
    # 时间戳
    created_at = models.DateTimeField('创建时间', auto_now_add=True, db_index=True)

    class Meta:
        db_table = 'activity_logs'
        verbose_name = '活动日志'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'created_at']),
            models.Index(fields=['resource_type', 'resource_id']),
            models.Index(fields=['action_type', 'created_at']),
        ]

    def __str__(self):
        return f'{self.get_action_type_display()} - {self.description}'

    @classmethod
    def log_activity(cls, action_type, description, user=None, ip_address=None, 
                     resource_type='other', resource_id=None, resource_name=None,
                     changes=None, status='success', error_message=None,
                     user_agent=None, request_path=None, request_method=None):
        """
        记录活动日志（增强版）
        
        Args:
            action_type: 操作类型
            description: 操作描述
            user: 操作用户
            ip_address: IP地址
            resource_type: 资源类型
            resource_id: 资源ID
            resource_name: 资源名称
            changes: 变更详情字典
            status: 操作状态
            error_message: 错误信息
            user_agent: 用户代理
            request_path: 请求路径
            request_method: 请求方法
        """
        return cls.objects.create(
            action_type=action_type,
            description=description,
            user=user,
            ip_address=ip_address,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=resource_name,
            changes=changes,
            status=status,
            error_message=error_message,
            user_agent=user_agent,
            request_path=request_path,
            request_method=request_method
        )


class VMMetricHistory(models.Model):
    """虚拟机监控历史数据"""
    virtual_machine = models.ForeignKey('information_systems.VirtualMachine', on_delete=models.CASCADE, verbose_name='虚拟机')
    cpu_usage = models.FloatField('CPU使用率(%)')  # 0-100
    memory_usage = models.FloatField('内存使用率(%)') # 0-100
    network_in_rate = models.FloatField('网络入流量(KB/s)', default=0)
    network_out_rate = models.FloatField('网络出流量(KB/s)', default=0)
    timestamp = models.DateTimeField('采集时间', db_index=True)

    class Meta:
        db_table = 'vm_metric_history'
        verbose_name = '虚拟机监控历史'
        verbose_name_plural = verbose_name
        indexes = [
            models.Index(fields=['virtual_machine', 'timestamp']),
        ]
        ordering = ['-timestamp']

    def __str__(self):
        return f"{self.virtual_machine.name} - {self.timestamp}"


class AlertRule(models.Model):
    """告警规则"""
    METRIC_TYPES = (
        ('cpu', 'CPU使用率'),
        ('memory', '内存使用率'),
        ('disk', '磁盘使用率'),
        ('network_in', '网络入流量'),
        ('network_out', '网络出流量'),
    )
    
    OPERATORS = (
        ('gt', '大于'),
        ('lt', '小于'),
    )

    name = models.CharField('规则名称', max_length=100)
    metric_type = models.CharField('指标类型', max_length=20, choices=METRIC_TYPES)
    threshold = models.FloatField('阈值')
    operator = models.CharField('比较操作符', max_length=10, choices=OPERATORS, default='gt')
    duration = models.IntegerField('持续时间(分钟)', default=5, help_text='持续超过该时间才触发告警')
    enabled = models.BooleanField('是否启用', default=True)
    
    # 关联范围：可以是全局，也可以是特定租户或特定VM
    virtual_machine = models.ForeignKey('information_systems.VirtualMachine', on_delete=models.CASCADE, null=True, blank=True, verbose_name='关联虚拟机')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'alert_rules'
        verbose_name = '告警规则'
        verbose_name_plural = verbose_name

    def __str__(self):
        return self.name


class AlertHistory(models.Model):
    """告警历史"""
    STATUS_CHOICES = (
        ('active', '触发中'),
        ('resolved', '已恢复'),
    )

    rule = models.ForeignKey(AlertRule, on_delete=models.CASCADE, verbose_name='触发规则')
    virtual_machine = models.ForeignKey('information_systems.VirtualMachine', on_delete=models.CASCADE, verbose_name='虚拟机')
    metric_value = models.FloatField('触发值')
    message = models.TextField('告警内容')
    status = models.CharField('状态', max_length=20, choices=STATUS_CHOICES, default='active')
    
    started_at = models.DateTimeField('开始时间', auto_now_add=True)
    resolved_at = models.DateTimeField('恢复时间', null=True, blank=True)

    class Meta:
        db_table = 'alert_history'
        verbose_name = '告警历史'
        verbose_name_plural = verbose_name
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.rule.name} - {self.virtual_machine.name} ({self.status})"


class ServiceHealthCheck(models.Model):
    """服务健康检查记录 - 用于计算真实可用性"""
    
    SERVICE_TYPES = (
        ('django', 'Django应用服务'),
        ('database', '数据库服务'),
        ('cache', '缓存服务'),
        ('celery', '任务队列服务'),
    )
    
    service_name = models.CharField('服务名称', max_length=50, choices=SERVICE_TYPES)
    is_healthy = models.BooleanField('是否健康', default=True)
    response_time_ms = models.IntegerField('响应时间(毫秒)', null=True, blank=True)
    error_message = models.TextField('错误信息', blank=True, default='')
    checked_at = models.DateTimeField('检查时间', auto_now_add=True)
    
    class Meta:
        db_table = 'service_health_checks'
        verbose_name = '服务健康检查'
        verbose_name_plural = verbose_name
        ordering = ['-checked_at']
        indexes = [
            models.Index(fields=['service_name', 'checked_at']),
        ]
    
    def __str__(self):
        status = '健康' if self.is_healthy else '异常'
        return f"{self.get_service_name_display()} - {status} ({self.checked_at.strftime('%Y-%m-%d %H:%M')})"
