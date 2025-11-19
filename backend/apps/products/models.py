"""
产品管理数据模型
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator, MaxValueValidator
import uuid


class Product(models.Model):
    """产品模型"""

    # 产品类型选择
    class ProductType(models.TextChoices):
        ECS = 'ecs', _('ECS计算资源')
        ODS = 'ods', _('ODS存储资源')
        NET = 'net', _('NET网络专线')
        ANQ = 'anq', _('AnQ安全服务')
        BAS = 'bas', _('BAS基础服务')
        OTHER = 'other', _('其他服务')

    # ECS计算资源子类别
    class ECSSubcategory(models.TextChoices):
        GENERAL = 'general', _('通用型')
        COMPUTE_OPTIMIZED = 'compute_optimized', _('计算优化型')
        MEMORY_OPTIMIZED = 'memory_optimized', _('内存优化型')
        STORAGE_OPTIMIZED = 'storage_optimized', _('存储优化型')
        GPU = 'gpu', _('GPU加速型')

    # ODS存储资源子类别
    class ODSSubcategory(models.TextChoices):
        BLOCK_STORAGE = 'block_storage', _('块存储')
        OBJECT_STORAGE = 'object_storage', _('对象存储')
        FILE_STORAGE = 'file_storage', _('文件存储')
        ARCHIVE_STORAGE = 'archive_storage', _('归档存储')

    # NET网络专线子类别
    class NETSubcategory(models.TextChoices):
        DATA_LINE = 'data_line', _('数据专线')
        DEDICATED_INTERNET = 'dedicated_internet', _('独占互联网线路')
        SHARED_INTERNET = 'shared_internet', _('共享互联网线路')
        VPN = 'vpn', _('VPN')

    # AnQ安全服务子类别
    class ANQSubcategory(models.TextChoices):
        DDOS_PROTECTION = 'ddos_protection', _('抗DDOS')
        IPS = 'ips', _('IPS')
        ANTIVIRUS = 'antivirus', _('防病毒')
        WAF = 'waf', _('WAF')
        WEB_PROTECTION = 'web_protection', _('网页防篡改')
        BASTION_HOST = 'bastion_host', _('堡垒机')
        VULNERABILITY_SCAN = 'vulnerability_scan', _('漏洞扫描')

    # BAS基础服务子类别
    class BASSubcategory(models.TextChoices):
        SYSTEM_MONITORING = 'system_monitoring', _('系统监控')
        LOG_AUDIT = 'log_audit', _('日志审计')
        TAPE_BACKUP = 'tape_backup', _('磁带备份')
        MONTHLY_REPORT = 'monthly_report', _('运维报告-月')
        QUARTERLY_REPORT = 'quarterly_report', _('运维报告-季')
        YEARLY_REPORT = 'yearly_report', _('运维报告-年')
        MONTHLY_YEARLY_REPORT = 'monthly_yearly_report', _('运维报告-月+年')
        QUARTERLY_YEARLY_REPORT = 'quarterly_yearly_report', _('运维报告-季+年')
        SECURITY_COMPLIANCE = 'security_compliance', _('监督检查-等保配合')
        DUE_DILIGENCE = 'due_diligence', _('监督检查-尽职调查')
        EXTERNAL_AUDIT = 'external_audit', _('监督检查-外部审计')

    # 定价模型选择
    class PricingModel(models.TextChoices):
        FIXED = 'fixed', _('固定价格')
        USAGE_BASED = 'usage_based', _('按使用量')
        TIERED = 'tiered', _('阶梯定价')
        SUBSCRIPTION = 'subscription', _('订阅制')
        HYBRID = 'hybrid', _('混合模式')

    # 计费周期选择
    class BillingPeriod(models.TextChoices):
        HOURLY = 'hourly', _('按小时')
        DAILY = 'daily', _('按天')
        WEEKLY = 'weekly', _('按周')
        MONTHLY = 'monthly', _('按月')
        QUARTERLY = 'quarterly', _('按季度')
        YEARLY = 'yearly', _('按年')

    # 计费单位选择
    class BillingUnit(models.TextChoices):
        CORE = 'core', _('核')
        GB = 'gb', _('GB')
        TB = 'tb', _('TB')
        INSTANCE = 'instance', _('实例')
        CONNECTION = 'connection', _('连接')
        REQUEST = 'request', _('请求')
        USER = 'user', _('用户')

    # 产品状态选择
    class Status(models.TextChoices):
        ACTIVE = 'active', _('启用')
        INACTIVE = 'inactive', _('停用')
        DRAFT = 'draft', _('草稿')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name=_('产品名称'), unique=True)
    code = models.CharField(max_length=50, verbose_name=_('产品编码'), unique=True)
    description = models.TextField(blank=True, verbose_name=_('产品描述'))

    # 产品分类
    product_type = models.CharField(
        max_length=20,
        choices=ProductType.choices,
        default=ProductType.ECS,
        verbose_name=_('产品类型')
    )

    # 子类别
    subcategory = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('子类别'),
        help_text=_('根据产品类型选择相应的子类别')
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_('产品状态')
    )

    # 定价信息
    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('基础价格')
    )

    billing_unit = models.CharField(
        max_length=20,
        choices=BillingUnit.choices,
        default=BillingUnit.CORE,
        verbose_name=_('计费单位')
    )

    billing_period = models.CharField(
        max_length=20,
        choices=BillingPeriod.choices,
        default=BillingPeriod.MONTHLY,
        verbose_name=_('计费周期')
    )

    pricing_model = models.CharField(
        max_length=20,
        choices=PricingModel.choices,
        default=PricingModel.FIXED,
        verbose_name=_('定价模型')
    )

    min_quantity = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=1,
        verbose_name=_('最小购买量')
    )

    # 容量规格
    cpu_capacity = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('CPU容量(核)')
    )
    memory_capacity = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('内存容量(GB)')
    )
    storage_capacity = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('存储容量(GB)')
    )

    # 产品特性
    features = models.TextField(blank=True, verbose_name=_('产品特性'))
    specifications = models.TextField(blank=True, verbose_name=_('技术规格'))
    service_level = models.CharField(max_length=100, blank=True, verbose_name=_('服务级别'))

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    # 管理信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_products',
        verbose_name=_('创建者')
    )

    class Meta:
        verbose_name = _('产品')
        verbose_name_plural = _('产品')
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def formatted_price(self):
        """格式化价格显示"""
        return f"¥{self.base_price}/{self.get_billing_unit_display()}/{self.get_billing_period_display()}"


class DiscountLevel(models.Model):
    """折扣级别模型"""

    # 客户类型选择
    class CustomerType(models.TextChoices):
        SUPERIOR_UNIT = 'superior_unit', _('上级单位')
        IMPORTANT_CUSTOMER = 'important_customer', _('重要客户')
        ORDINARY_CUSTOMER = 'ordinary_customer', _('普通客户')

    # 状态选择
    class Status(models.TextChoices):
        ACTIVE = 'active', _('启用')
        INACTIVE = 'inactive', _('停用')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name=_('折扣级别名称'), unique=True)
    code = models.CharField(max_length=50, verbose_name=_('折扣级别编码'), unique=True)
    description = models.TextField(blank=True, verbose_name=_('描述'))

    # 折扣配置
    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        verbose_name=_('折扣率'),
        help_text=_('0.9表示9折，0.8表示8折')
    )

    customer_type = models.CharField(
        max_length=20,
        choices=CustomerType.choices,
        default=CustomerType.ORDINARY_CUSTOMER,
        verbose_name=_('客户类型')
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.ACTIVE,
        verbose_name=_('状态')
    )

    # 消费门槛
    min_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('最小消费金额'),
        help_text=_('0表示无限制')
    )

    max_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('最大消费金额'),
        help_text=_('0表示无限制')
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    # 管理信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_discount_levels',
        verbose_name=_('创建者')
    )

    class Meta:
        verbose_name = _('折扣级别')
        verbose_name_plural = _('折扣级别')
        ordering = ['discount_rate']

    def __str__(self):
        return f"{self.name} ({self.discount_rate * 100}%)"

    @property
    def discount_percentage(self):
        """获取折扣百分比"""
        return int((1 - self.discount_rate) * 100)


class ProductSubscription(models.Model):
    """产品订阅模型"""

    # 订阅状态选择
    class SubscriptionStatus(models.TextChoices):
        PENDING = 'pending', _('待审批')
        ACTIVE = 'active', _('生效中')
        SUSPENDED = 'suspended', _('已暂停')
        TERMINATED = 'terminated', _('已终止')
        EXPIRED = 'expired', _('已过期')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 关联关系
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='product_subscriptions',
        verbose_name=_('租户')
    )

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='subscriptions',
        verbose_name=_('产品')
    )

    contract = models.ForeignKey(
        'contracts.Contract',
        on_delete=models.CASCADE,
        related_name='product_subscriptions',
        verbose_name=_('合同'),
        null=True,
        blank=True
    )

    # 订阅配置
    quantity = models.IntegerField(
        validators=[MinValueValidator(1)],
        default=1,
        verbose_name=_('订阅数量')
    )

    status = models.CharField(
        max_length=20,
        choices=SubscriptionStatus.choices,
        default=SubscriptionStatus.ACTIVE,
        verbose_name=_('订阅状态')
    )

    # 价格信息
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('单价')
    )

    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=1.0000,
        verbose_name=_('折扣率')
    )

    monthly_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('月费用')
    )

    # 时间信息
    start_date = models.DateField(verbose_name=_('开始日期'))
    end_date = models.DateField(verbose_name=_('结束日期'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    # 管理信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_subscriptions',
        verbose_name=_('创建者')
    )

    class Meta:
        verbose_name = _('产品订阅')
        verbose_name_plural = _('产品订阅')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.tenant.name} - {self.product.name}"

    def save(self, *args, **kwargs):
        """保存时自动计算月费用"""
        self.monthly_cost = self.unit_price * self.quantity * self.discount_rate
        super().save(*args, **kwargs)

    @property
    def is_active(self):
        """检查订阅是否活跃"""
        from django.utils import timezone
        today = timezone.now().date()
        return (
            self.status == self.SubscriptionStatus.ACTIVE and
            self.start_date <= today <= self.end_date
        )


class PricingTier(models.Model):
    """定价阶梯模型"""

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name='pricing_tiers',
        verbose_name=_('产品')
    )

    # 阶梯配置
    min_quantity = models.IntegerField(
        validators=[MinValueValidator(0)],
        verbose_name=_('最小数量')
    )

    max_quantity = models.IntegerField(
        validators=[MinValueValidator(0)],
        null=True,
        blank=True,
        verbose_name=_('最大数量'),
        help_text=_('为空表示无上限')
    )

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('阶梯单价')
    )

    # 排序
    order = models.IntegerField(default=0, verbose_name=_('排序'))

    class Meta:
        verbose_name = _('定价阶梯')
        verbose_name_plural = _('定价阶梯')
        ordering = ['order', 'min_quantity']

    def __str__(self):
        if self.max_quantity:
            return f"{self.product.name} - {self.min_quantity}-{self.max_quantity} ({self.unit_price})"
        else:
            return f"{self.product.name} - {self.min_quantity}+ ({self.unit_price})"