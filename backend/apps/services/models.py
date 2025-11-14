"""
服务管理模型
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _


class Service(models.Model):
    """服务模型"""

    class ServiceType(models.TextChoices):
        """服务类型"""
        COMPUTE = 'compute', _('计算服务')
        STORAGE = 'storage', _('存储服务')
        NETWORK = 'network', _('网络服务')
        SECURITY = 'security', _('安全服务')
        MONITORING = 'monitoring', _('监控服务')
        BACKUP = 'backup', _('备份服务')
        OTHER = 'other', _('其他服务')

    class AvailabilityLevel(models.TextChoices):
        """可用性级别"""
        FIVE_NINES = '99.999%', _('99.999%')
        FOUR_NINES = '99.99%', _('99.99%')
        THREE_NINES_SEVENTY_FIVE = '99.75%', _('99.75%')
        THREE_NINES = '99.9%', _('99.9%')

    class MTTRLevel(models.TextChoices):
        """平均修复时间级别"""
        THIRTY_MINUTES = '<=30min', _('<=30分钟')
        TWO_HOURS = '<=2h', _('<=2小时')
        FOUR_HOURS = '<=4h', _('<=4小时')
        EIGHT_HOURS = '<=8h', _('<=8小时')
        TWENTY_FOUR_HOURS = '<=24h', _('<=24小时')

    class RPOLevel(models.TextChoices):
        """恢复点目标级别"""
        ZERO = '0', _('0')
        ONE_HOUR = '1h', _('1小时')

    class RTOLevel(models.TextChoices):
        """恢复时间目标级别"""
        ONE_HOUR = '<=1h', _('<=1小时')
        ONE_TO_FOUR_HOURS = '1-4h', _('1小时<RTO<=4小时')
        OVER_FOUR_HOURS = '>4h', _('>4小时')

    # 基本信息
    name = models.CharField(_('服务名称'), max_length=200)
    code = models.CharField(_('服务编码'), max_length=50, unique=True)
    description = models.TextField(_('服务描述'), blank=True)
    service_type = models.CharField(
        _('服务类型'),
        max_length=20,
        choices=ServiceType.choices,
        default=ServiceType.OTHER
    )
    status = models.CharField(
        _('状态'),
        max_length=20,
        choices=[
            ('active', _('启用')),
            ('inactive', _('停用')),
            ('draft', _('草稿'))
        ],
        default='active'
    )

    # SLA指标
    availability = models.CharField(
        _('可用性'),
        max_length=10,
        choices=AvailabilityLevel.choices,
        default=AvailabilityLevel.THREE_NINES
    )
    mttr = models.CharField(
        _('平均响应时间'),
        max_length=10,
        choices=MTTRLevel.choices,
        default=MTTRLevel.FOUR_HOURS
    )
    rpo = models.CharField(
        _('本地恢复点目标'),
        max_length=10,
        choices=RPOLevel.choices,
        default=RPOLevel.ONE_HOUR
    )
    rto = models.CharField(
        _('本地恢复时间目标'),
        max_length=10,
        choices=RTOLevel.choices,
        default=RTOLevel.ONE_TO_FOUR_HOURS
    )
    complaint_rate = models.DecimalField(
        _('事件平均客户投诉率'),
        max_digits=5,
        decimal_places=4,
        default=0.0001,
        help_text=_('投诉总数/统计次数')
    )
    network_availability = models.DecimalField(
        _('信息网络运行率'),
        max_digits=5,
        decimal_places=2,
        default=99.9,
        help_text=_('[(周期时长-网络节点中断时长-计划内停用时长)/(周期时长-计划内停用时长)]*100%')
    )

    # 定价信息
    base_price = models.DecimalField(_('基础价格'), max_digits=10, decimal_places=2, default=0)
    billing_unit = models.CharField(
        _('计费单位'),
        max_length=20,
        choices=[
            ('month', _('月')),
            ('quarter', _('季度')),
            ('year', _('年')),
            ('instance', _('实例')),
            ('user', _('用户')),
            ('gb', _('GB')),
            ('request', _('请求数'))
        ],
        default='month'
    )
    billing_period = models.CharField(
        _('计费周期'),
        max_length=20,
        choices=[
            ('monthly', _('按月')),
            ('quarterly', _('按季度')),
            ('yearly', _('按年')),
            ('usage', _('按使用量'))
        ],
        default='monthly'
    )

    # 其他信息
    features = models.TextField(_('服务特性'), blank=True)
    specifications = models.TextField(_('技术规格'), blank=True)
    service_level = models.CharField(_('服务等级'), max_length=100, blank=True)

    # 审计字段
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_services',
        verbose_name=_('创建人')
    )

    class Meta:
        verbose_name = _('服务')
        verbose_name_plural = _('服务')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.code})"


class ServiceSubscription(models.Model):
    """服务订阅模型"""

    class SubscriptionStatus(models.TextChoices):
        """订阅状态"""
        ACTIVE = 'active', _('活跃')
        SUSPENDED = 'suspended', _('暂停')
        TERMINATED = 'terminated', _('终止')
        EXPIRED = 'expired', _('过期')

    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='service_subscriptions',
        verbose_name=_('租户')
    )
    service = models.ForeignKey(
        Service,
        on_delete=models.CASCADE,
        related_name='subscriptions',
        verbose_name=_('服务')
    )
    contract = models.ForeignKey(
        'contracts.Contract',
        on_delete=models.CASCADE,
        related_name='service_subscriptions',
        verbose_name=_('合同')
    )

    # 订阅信息
    status = models.CharField(
        _('状态'),
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE
    )
    unit_price = models.DecimalField(_('单价'), max_digits=10, decimal_places=2)
    discount_rate = models.DecimalField(
        _('折扣率'),
        max_digits=5,
        decimal_places=4,
        default=1.0,
        help_text=_('1.0表示无折扣，0.8表示20%折扣')
    )
    monthly_cost = models.DecimalField(_('月费用'), max_digits=10, decimal_places=2, default=0)

    # 时间信息
    start_date = models.DateField(_('开始日期'))
    end_date = models.DateField(_('结束日期'), null=True, blank=True)

    # 审计字段
    created_at = models.DateTimeField(_('创建时间'), auto_now_add=True)
    updated_at = models.DateTimeField(_('更新时间'), auto_now=True)
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_service_subscriptions',
        verbose_name=_('创建人')
    )

    class Meta:
        verbose_name = _('服务订阅')
        verbose_name_plural = _('服务订阅')
        ordering = ['-created_at']
        unique_together = ['tenant', 'service', 'contract']

    def __str__(self):
        return f"{self.tenant.name} - {self.service.name}"

    def save(self, *args, **kwargs):
        """保存时计算月费用"""
        if self.unit_price and self.discount_rate:
            self.monthly_cost = self.unit_price * self.discount_rate
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        """检查订阅是否活跃"""
        return self.status == self.SubscriptionStatus.ACTIVE