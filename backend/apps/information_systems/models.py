"""
信息系统管理数据模型
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
import uuid


class InformationSystem(models.Model):
    """信息系统模型"""

    # 系统类型选择
    class SystemType(models.TextChoices):
        APPLICATION = 'application', _('应用系统')
        DATABASE = 'database', _('数据库系统')
        MIDDLEWARE = 'middleware', _('中间件系统')
        MONITORING = 'monitoring', _('监控系统')
        BACKUP = 'backup', _('备份系统')
        OTHER = 'other', _('其他系统')

    # 运行模式选择
    class OperationMode(models.TextChoices):
        HOURS_7X24 = '7x24', _('7x24小时')
        HOURS_5X8 = '5x8', _('5x8小时')

    # 系统状态选择
    class Status(models.TextChoices):
        RUNNING = 'running', _('运行中')
        STOPPED = 'stopped', _('已停止')
        MAINTENANCE = 'maintenance', _('维护中')
        ERROR = 'error', _('异常')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name=_('系统名称'), unique=True)
    code = models.CharField(max_length=50, verbose_name=_('系统编码'), unique=True)
    description = models.TextField(blank=True, verbose_name=_('系统描述'))

    # 系统分类
    system_type = models.CharField(
        max_length=20,
        choices=SystemType.choices,
        default=SystemType.APPLICATION,
        verbose_name=_('系统类型')
    )

    operation_mode = models.CharField(
        max_length=10,
        choices=OperationMode.choices,
        default=OperationMode.HOURS_7X24,
        verbose_name=_('运行模式')
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.STOPPED,
        verbose_name=_('系统状态')
    )

    # 关联租户
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='information_systems',
        verbose_name=_('所属租户')
    )

    # 关联产品和服务
    products = models.ManyToManyField(
        'products.Product',
        blank=True,
        related_name='information_systems',
        verbose_name=_('订阅产品')
    )
    services = models.ManyToManyField(
        'services.Service',
        blank=True,
        related_name='information_systems',
        verbose_name=_('订阅服务')
    )

    # 服务内容（保留作为备注）
    service_content = models.TextField(blank=True, default='', verbose_name=_('服务内容备注'))
    product_content = models.TextField(blank=True, default='', verbose_name=_('产品内容备注'))

    # 资源总量
    total_cpu = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('CPU总量(核)')
    )
    total_memory = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('内存总量(GB)')
    )
    total_storage = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('存储总量(GB)')
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    last_start_time = models.DateTimeField(null=True, blank=True, verbose_name=_('最后启动时间'))
    last_stop_time = models.DateTimeField(null=True, blank=True, verbose_name=_('最后停止时间'))

    # 管理信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_information_systems',
        verbose_name=_('创建者')
    )

    class Meta:
        verbose_name = _('信息系统')
        verbose_name_plural = _('信息系统')
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def running_time(self):
        """计算运行时间"""
        if self.status == self.Status.RUNNING and self.last_start_time:
            from django.utils import timezone
            return timezone.now() - self.last_start_time
        return None

    @property
    def monthly_cost(self):
        """计算月费用"""
        # 基础费用计算逻辑
        base_cost = (self.total_cpu * 50) + (self.total_memory * 10) + (self.total_storage * 0.1)

        # 应用折扣
        discount_rate = self.tenant.discount_rate
        return base_cost * discount_rate


class SystemResource(models.Model):
    """系统资源详情"""

    # 资源类型选择
    class ResourceType(models.TextChoices):
        COMPUTE = 'compute', _('计算资源')
        STORAGE = 'storage', _('存储资源')
        NETWORK = 'network', _('网络资源')
        DATABASE = 'database', _('数据库资源')

    # 资源状态选择
    class ResourceStatus(models.TextChoices):
        ACTIVE = 'active', _('活跃')
        INACTIVE = 'inactive', _('非活跃')
        ERROR = 'error', _('错误')
        MAINTENANCE = 'maintenance', _('维护')

    information_system = models.ForeignKey(
        InformationSystem,
        on_delete=models.CASCADE,
        related_name='resources',
        verbose_name=_('信息系统')
    )

    # 资源基本信息
    name = models.CharField(max_length=200, verbose_name=_('资源名称'))
    resource_type = models.CharField(
        max_length=20,
        choices=ResourceType.choices,
        verbose_name=_('资源类型')
    )
    status = models.CharField(
        max_length=20,
        choices=ResourceStatus.choices,
        default=ResourceStatus.INACTIVE,
        verbose_name=_('资源状态')
    )

    # 资源规格
    region = models.CharField(max_length=100, verbose_name=_('区域'))
    ip_address = models.GenericIPAddressField(blank=True, null=True, verbose_name=_('IP地址'))
    cpu_cores = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('CPU核数')
    )
    memory_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('内存大小(GB)')
    )
    storage_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('存储容量(GB)')
    )

    # OpenStack相关
    openstack_resource_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_('OpenStack资源ID')
    )
    openstack_resource_type = models.CharField(
        max_length=50,
        blank=True,
        null=True,
        verbose_name=_('OpenStack资源类型')
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    start_time = models.DateTimeField(null=True, blank=True, verbose_name=_('启动时间'))
    running_time = models.DurationField(null=True, blank=True, verbose_name=_('运行时间'))

    class Meta:
        verbose_name = _('系统资源')
        verbose_name_plural = _('系统资源')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.information_system.name} - {self.name}"


class SystemOperationLog(models.Model):
    """系统操作日志"""

    class OperationType(models.TextChoices):
        START = 'start', _('启动')
        STOP = 'stop', _('停止')
        RESTART = 'restart', _('重启')
        MAINTENANCE = 'maintenance', _('维护')
        UPDATE = 'update', _('更新')
        DELETE = 'delete', _('删除')

    information_system = models.ForeignKey(
        InformationSystem,
        on_delete=models.CASCADE,
        related_name='operation_logs',
        verbose_name=_('信息系统')
    )

    operation_type = models.CharField(
        max_length=20,
        choices=OperationType.choices,
        verbose_name=_('操作类型')
    )
    operation_detail = models.TextField(verbose_name=_('操作详情'))
    operator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_('操作者')
    )
    operation_time = models.DateTimeField(auto_now_add=True, verbose_name=_('操作时间'))

    class Meta:
        verbose_name = _('系统操作日志')
        verbose_name_plural = _('系统操作日志')
        ordering = ['-operation_time']

    def __str__(self):
        return f"{self.information_system.name} - {self.get_operation_type_display()}"


class SystemBillingRecord(models.Model):
    """系统计费记录"""

    information_system = models.ForeignKey(
        InformationSystem,
        on_delete=models.CASCADE,
        related_name='billing_records',
        verbose_name=_('信息系统')
    )

    # 计费信息
    billing_period = models.DateField(verbose_name=_('计费周期'))
    base_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('基础费用')
    )
    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=1.0000,
        verbose_name=_('折扣率')
    )
    actual_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('实际费用')
    )

    # 使用统计
    running_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('运行小时数')
    )
    cpu_usage_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('CPU使用小时数')
    )
    memory_usage_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('内存使用小时数')
    )
    storage_usage_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('存储使用小时数')
    )

    # 状态
    is_paid = models.BooleanField(default=False, verbose_name=_('是否已支付'))
    paid_date = models.DateTimeField(null=True, blank=True, verbose_name=_('支付时间'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('系统计费记录')
        verbose_name_plural = _('系统计费记录')
        ordering = ['-billing_period']

    def __str__(self):
        return f"{self.information_system.name} - {self.billing_period.strftime('%Y-%m')}"

    def save(self, *args, **kwargs):
        """保存时自动计算实际费用"""
        from decimal import Decimal
        self.actual_cost = self.base_cost * Decimal(str(self.discount_rate))
        super().save(*args, **kwargs)


class DailyBillingRecord(models.Model):
    """每日计费记录"""

    information_system = models.ForeignKey(
        InformationSystem,
        on_delete=models.CASCADE,
        related_name='daily_billing_records',
        verbose_name=_('信息系统')
    )

    # 计费日期
    billing_date = models.DateField(verbose_name=_('计费日期'))

    # 资源快照（记录当天的资源规格）
    cpu_cores = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('CPU核数')
    )
    memory_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('内存大小(GB)'))
    storage_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('存储容量(GB)'))

    # 使用统计
    running_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('运行小时数')
    )
    cpu_usage_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('CPU使用小时数')
    )
    memory_usage_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('内存使用小时数')
    )
    storage_usage_hours = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('存储使用小时数')
    )

    # 费用计算
    hourly_rate = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        default=0,
        verbose_name=_('小时费率')
    )
    daily_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name=_('日费用')
    )

    # 折扣信息
    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=1.0000,
        verbose_name=_('折扣率')
    )
    actual_daily_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name=_('实际日费用')
    )

    # 状态
    is_processed = models.BooleanField(default=False, verbose_name=_('是否已处理'))
    processed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('处理时间'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('每日计费记录')
        verbose_name_plural = _('每日计费记录')
        ordering = ['-billing_date']
        unique_together = ['information_system', 'billing_date']

    def __str__(self):
        return f"{self.information_system.name} - {self.billing_date.strftime('%Y-%m-%d')}"

    def calculate_daily_cost(self):
        """计算日费用"""
        # 基础定价模型：CPU * 0.1 + 内存 * 0.05 + 存储 * 0.01 (每小时)
        cpu_cost = self.cpu_cores * 0.1
        memory_cost = self.memory_gb * 0.05
        storage_cost = self.storage_gb * 0.01

        hourly_rate = cpu_cost + memory_cost + storage_cost
        self.hourly_rate = hourly_rate
        self.daily_cost = hourly_rate * self.running_hours
        self.actual_daily_cost = self.daily_cost * self.discount_rate

    def save(self, *args, **kwargs):
        """保存时自动计算费用"""
        if not self.pk or self._state.adding:
            self.calculate_daily_cost()
        super().save(*args, **kwargs)


class ResourceAdjustmentLog(models.Model):
    """资源调整日志"""

    class AdjustmentType(models.TextChoices):
        CPU_UPGRADE = 'cpu_upgrade', _('CPU升级')
        CPU_DOWNGRADE = 'cpu_downgrade', _('CPU降级')
        MEMORY_UPGRADE = 'memory_upgrade', _('内存升级')
        MEMORY_DOWNGRADE = 'memory_downgrade', _('内存降级')
        STORAGE_UPGRADE = 'storage_upgrade', _('存储升级')
        STORAGE_DOWNGRADE = 'storage_downgrade', _('存储降级')

    information_system = models.ForeignKey(
        InformationSystem,
        on_delete=models.CASCADE,
        related_name='resource_adjustments',
        verbose_name=_('信息系统')
    )

    adjustment_type = models.CharField(
        max_length=20,
        choices=AdjustmentType.choices,
        verbose_name=_('调整类型')
    )

    # 调整前资源规格
    old_cpu_cores = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('调整前CPU核数')
    )
    old_memory_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('调整前内存大小(GB)'))
    old_storage_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('调整前存储容量(GB)'))

    # 调整后资源规格
    new_cpu_cores = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('调整后CPU核数')
    )
    new_memory_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('调整后内存大小(GB)'))
    new_storage_gb = models.IntegerField(
        validators=[MinValueValidator(0)],
        default=0,
        verbose_name=_('调整后存储容量(GB)'))

    # 调整详情
    adjustment_detail = models.TextField(verbose_name=_('调整详情'))
    adjustment_date = models.DateTimeField(verbose_name=_('调整时间'))
    effective_date = models.DateField(verbose_name=_('生效日期'))

    # 操作信息
    operator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_('操作者')
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))

    class Meta:
        verbose_name = _('资源调整日志')
        verbose_name_plural = _('资源调整日志')
        ordering = ['-adjustment_date']

    def __str__(self):
        return f"{self.information_system.name} - {self.get_adjustment_type_display()} - {self.adjustment_date.strftime('%Y-%m-%d %H:%M')}"

    @property
    def cost_impact(self):
        """计算费用影响"""
        # 计算每小时费用差异
        old_hourly_cost = (self.old_cpu_cores * 0.1) + (self.old_memory_gb * 0.05) + (self.old_storage_gb * 0.01)
        new_hourly_cost = (self.new_cpu_cores * 0.1) + (self.new_memory_gb * 0.05) + (self.new_storage_gb * 0.01)

        return new_hourly_cost - old_hourly_cost


class VirtualMachine(models.Model):
    """虚拟机模型"""

    class VMStatus(models.TextChoices):
        RUNNING = 'running', _('运行中')
        STOPPED = 'stopped', _('已停止')
        PAUSED = 'paused', _('已暂停')
        ERROR = 'error', _('异常')

    class DataCenterType(models.TextChoices):
        PRODUCTION = 'production', _('生产环境')
        LOCAL_DR = 'local_dr', _('同城灾备')
        REMOTE_DR = 'remote_dr', _('异地灾备')
        DEVELOPMENT = 'development', _('开发环境')
        TESTING = 'testing', _('测试环境')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name=_('虚拟机名称'))

    # 关联信息系统
    information_system = models.ForeignKey(
        InformationSystem,
        on_delete=models.CASCADE,
        related_name='virtual_machines',
        verbose_name=_('所属信息系统')
    )

    # 数据中心和区域信息
    data_center_type = models.CharField(
        max_length=20,
        choices=DataCenterType.choices,
        default=DataCenterType.PRODUCTION,
        verbose_name=_('数据中心类型')
    )
    availability_zone = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('可用区')
    )
    region = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('区域')
    )

    # 资源配置
    cpu_cores = models.IntegerField(
        validators=[MinValueValidator(1)],
        default=2,
        verbose_name=_('CPU核数')
    )
    memory_gb = models.IntegerField(
        validators=[MinValueValidator(1)],
        default=4,
        verbose_name=_('内存大小(GB)')
    )
    disk_gb = models.IntegerField(
        validators=[MinValueValidator(10)],
        default=100,
        verbose_name=_('磁盘容量(GB)')
    )

    # 网络信息
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name=_('IP地址')
    )
    mac_address = models.CharField(
        max_length=17,
        blank=True,
        verbose_name=_('MAC地址')
    )

    # 运行状态
    status = models.CharField(
        max_length=20,
        choices=VMStatus.choices,
        default=VMStatus.STOPPED,
        verbose_name=_('状态')
    )

    # 运行时间配置
    runtime_start = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_('运行开始时间')
    )
    runtime_end = models.TimeField(
        null=True,
        blank=True,
        verbose_name=_('运行结束时间')
    )

    # OpenStack相关
    openstack_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        unique=True,
        verbose_name=_('OpenStack实例ID')
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    last_start_time = models.DateTimeField(null=True, blank=True, verbose_name=_('最后启动时间'))
    last_stop_time = models.DateTimeField(null=True, blank=True, verbose_name=_('最后停止时间'))

    # 操作系统信息
    os_type = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('操作系统类型')
    )
    os_version = models.CharField(
        max_length=50,
        blank=True,
        verbose_name=_('操作系统版本')
    )

    # 描述
    description = models.TextField(blank=True, verbose_name=_('描述'))

    # 创建者
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_vms',
        verbose_name=_('创建者')
    )

    class Meta:
        verbose_name = _('虚拟机')
        verbose_name_plural = _('虚拟机')
        ordering = ['-created_at']
        unique_together = ['information_system', 'name']

    def __str__(self):
        return f"{self.name} ({self.information_system.name})"

    @property
    def runtime_display(self):
        """返回运行时间的显示格式"""
        if self.runtime_start and self.runtime_end:
            return f"{self.runtime_start.strftime('%H:%M')}-{self.runtime_end.strftime('%H:%M')}"
        return "全天"

    @property
    def uptime(self):
        """计算虚拟机运行时长"""
        if self.status == self.VMStatus.RUNNING and self.last_start_time:
            from django.utils import timezone
            return timezone.now() - self.last_start_time
        return None



class VMOperationLog(models.Model):
    """虚拟机操作日志"""

    class OperationType(models.TextChoices):
        START = 'start', _('启动')
        STOP = 'stop', _('停止')
        RESTART = 'restart', _('重启')
        PAUSE = 'pause', _('暂停')
        RESUME = 'resume', _('恢复')
        DELETE = 'delete', _('删除')

    virtual_machine = models.ForeignKey(
        VirtualMachine,
        on_delete=models.CASCADE,
        related_name='operation_logs',
        verbose_name=_('虚拟机')
    )

    operation_type = models.CharField(
        max_length=20,
        choices=OperationType.choices,
        verbose_name=_('操作类型')
    )

    operator = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        verbose_name=_('操作者')
    )

    operation_time = models.DateTimeField(auto_now_add=True, verbose_name=_('操作时间'))
    operation_detail = models.TextField(blank=True, verbose_name=_('操作详情'))
    success = models.BooleanField(default=True, verbose_name=_('是否成功'))
    error_message = models.TextField(blank=True, verbose_name=_('错误信息'))

    class Meta:
        verbose_name = _('虚拟机操作日志')
        verbose_name_plural = _('虚拟机操作日志')
        ordering = ['-operation_time']

    def __str__(self):
        return f"{self.virtual_machine.name} - {self.get_operation_type_display()} - {self.operation_time.strftime('%Y-%m-%d %H:%M:%S')}"