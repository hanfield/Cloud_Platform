from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _


class PhysicalAsset(models.Model):
    """有形资产模型"""

    class AssetType(models.TextChoices):
        SERVER = 'server', _('服务器')
        STORAGE = 'storage', _('存储设备')
        NETWORK = 'network', _('网络设备')
        SECURITY = 'security', _('安全设备')
        OTHER = 'other', _('其他设备')

    class AssetStatus(models.TextChoices):
        IN_USE = 'in_use', _('使用中')
        IDLE = 'idle', _('闲置')
        MAINTENANCE = 'maintenance', _('维护中')
        RETIRED = 'retired', _('已退役')
        DAMAGED = 'damaged', _('损坏')

    name = models.CharField(max_length=200, verbose_name=_('资产名称'))
    asset_type = models.CharField(
        max_length=20,
        choices=AssetType.choices,
        default=AssetType.SERVER,
        verbose_name=_('资产类型')
    )
    manufacturer = models.CharField(max_length=100, verbose_name=_('设备厂商'))
    model = models.CharField(max_length=100, verbose_name=_('设备型号'))
    serial_number = models.CharField(max_length=100, unique=True, verbose_name=_('序列号'))

    purchase_contract = models.ForeignKey(
        'contracts.Contract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='purchased_assets',
        verbose_name=_('采购合同')
    )
    purchase_date = models.DateField(null=True, blank=True, verbose_name=_('采购日期'))
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('采购价格')
    )
    residual_value = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('残值')
    )

    current_user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='current_assets',
        verbose_name=_('当前使用人')
    )

    status = models.CharField(
        max_length=20,
        choices=AssetStatus.choices,
        default=AssetStatus.IN_USE,
        verbose_name=_('资产状态')
    )

    data_center = models.CharField(max_length=100, blank=True, verbose_name=_('数据中心'))
    machine_room = models.CharField(max_length=100, blank=True, verbose_name=_('机房'))
    cabinet = models.CharField(max_length=50, blank=True, verbose_name=_('机柜'))
    u_position_start = models.IntegerField(null=True, blank=True, verbose_name=_('起始U位'))
    u_position_end = models.IntegerField(null=True, blank=True, verbose_name=_('结束U位'))

    description = models.TextField(blank=True, verbose_name=_('描述'))
    notes = models.TextField(blank=True, verbose_name=_('备注'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_assets',
        verbose_name=_('创建人')
    )

    class Meta:
        db_table = 'assets_physical_asset'
        verbose_name = _('有形资产')
        verbose_name_plural = _('有形资产')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.serial_number})"


class AssetUsageHistory(models.Model):
    """资产使用历史记录"""

    asset = models.ForeignKey(
        PhysicalAsset,
        on_delete=models.CASCADE,
        related_name='usage_history',
        verbose_name=_('资产')
    )
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='asset_usage_history',
        verbose_name=_('使用人')
    )
    start_date = models.DateField(verbose_name=_('开始使用日期'))
    end_date = models.DateField(null=True, blank=True, verbose_name=_('结束使用日期'))
    notes = models.TextField(blank=True, verbose_name=_('备注'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))

    class Meta:
        db_table = 'assets_usage_history'
        verbose_name = _('资产使用历史')
        verbose_name_plural = _('资产使用历史')
        ordering = ['-start_date']

    def __str__(self):
        return f"{self.asset.name} - {self.user.username if self.user else 'N/A'} ({self.start_date})"


class MaintenanceContract(models.Model):
    """维保合同"""

    class ContractStatus(models.TextChoices):
        ACTIVE = 'active', _('有效')
        EXPIRED = 'expired', _('已过期')
        TERMINATED = 'terminated', _('已终止')

    contract_number = models.CharField(max_length=100, unique=True, verbose_name=_('合同编号'))
    name = models.CharField(max_length=200, verbose_name=_('合同名称'))
    vendor = models.CharField(max_length=200, verbose_name=_('维保厂商'))
    contact_person = models.CharField(max_length=100, verbose_name=_('联系人'))
    contact_phone = models.CharField(max_length=50, verbose_name=_('联系电话'))
    contact_email = models.EmailField(verbose_name=_('联系邮箱'))

    contract = models.ForeignKey(
        'contracts.Contract',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='maintenance_contracts',
        verbose_name=_('关联合同')
    )

    start_date = models.DateField(verbose_name=_('开始日期'))
    end_date = models.DateField(verbose_name=_('结束日期'))
    contract_amount = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        verbose_name=_('合同金额')
    )

    status = models.CharField(
        max_length=20,
        choices=ContractStatus.choices,
        default=ContractStatus.ACTIVE,
        verbose_name=_('合同状态')
    )

    service_scope = models.TextField(verbose_name=_('服务范围'))
    response_time = models.CharField(max_length=100, blank=True, verbose_name=_('响应时间'))
    notes = models.TextField(blank=True, verbose_name=_('备注'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_maintenance_contracts',
        verbose_name=_('创建人')
    )

    class Meta:
        db_table = 'assets_maintenance_contract'
        verbose_name = _('维保合同')
        verbose_name_plural = _('维保合同')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.contract_number})"


class AssetMaintenance(models.Model):
    """资产维保记录"""

    asset = models.ForeignKey(
        PhysicalAsset,
        on_delete=models.CASCADE,
        related_name='maintenance_records',
        verbose_name=_('资产')
    )
    maintenance_contract = models.ForeignKey(
        MaintenanceContract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='maintenance_records',
        verbose_name=_('维保合同')
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        db_table = 'assets_maintenance'
        verbose_name = _('资产维保')
        verbose_name_plural = _('资产维保')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.asset.name} - {self.maintenance_contract.name if self.maintenance_contract else 'N/A'}"


class MaintenanceRecord(models.Model):
    """维保记录"""

    class RecordType(models.TextChoices):
        ROUTINE = 'routine', _('例行维护')
        REPAIR = 'repair', _('故障维修')
        UPGRADE = 'upgrade', _('升级改造')
        INSPECTION = 'inspection', _('巡检')

    class RecordStatus(models.TextChoices):
        PENDING = 'pending', _('待处理')
        IN_PROGRESS = 'in_progress', _('处理中')
        COMPLETED = 'completed', _('已完成')
        CANCELLED = 'cancelled', _('已取消')

    asset = models.ForeignKey(
        PhysicalAsset,
        on_delete=models.CASCADE,
        related_name='maintenance_history',
        verbose_name=_('资产')
    )
    maintenance_contract = models.ForeignKey(
        MaintenanceContract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='records',
        verbose_name=_('维保合同')
    )

    record_type = models.CharField(
        max_length=20,
        choices=RecordType.choices,
        default=RecordType.ROUTINE,
        verbose_name=_('记录类型')
    )
    status = models.CharField(
        max_length=20,
        choices=RecordStatus.choices,
        default=RecordStatus.PENDING,
        verbose_name=_('状态')
    )

    scheduled_date = models.DateField(verbose_name=_('计划日期'))
    actual_date = models.DateField(null=True, blank=True, verbose_name=_('实际日期'))

    technician = models.CharField(max_length=100, blank=True, verbose_name=_('技术人员'))
    description = models.TextField(verbose_name=_('维护描述'))
    result = models.TextField(blank=True, verbose_name=_('维护结果'))
    cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('费用')
    )

    notes = models.TextField(blank=True, verbose_name=_('备注'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_maintenance_records',
        verbose_name=_('创建人')
    )

    class Meta:
        db_table = 'assets_maintenance_record'
        verbose_name = _('维保记录')
        verbose_name_plural = _('维保记录')
        ordering = ['-scheduled_date']

    def __str__(self):
        return f"{self.asset.name} - {self.get_record_type_display()} ({self.scheduled_date})"


class IntangibleAsset(models.Model):
    """无形资产模型（待细化）"""

    class AssetType(models.TextChoices):
        SOFTWARE_LICENSE = 'software_license', _('软件许可')
        PATENT = 'patent', _('专利')
        TRADEMARK = 'trademark', _('商标')
        COPYRIGHT = 'copyright', _('著作权')
        DOMAIN = 'domain', _('域名')
        OTHER = 'other', _('其他')

    class AssetStatus(models.TextChoices):
        ACTIVE = 'active', _('有效')
        EXPIRED = 'expired', _('已过期')
        SUSPENDED = 'suspended', _('暂停')
        TERMINATED = 'terminated', _('已终止')

    name = models.CharField(max_length=200, verbose_name=_('资产名称'))
    asset_type = models.CharField(
        max_length=30,
        choices=AssetType.choices,
        default=AssetType.SOFTWARE_LICENSE,
        verbose_name=_('资产类型')
    )

    purchase_date = models.DateField(null=True, blank=True, verbose_name=_('购买日期'))
    purchase_price = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name=_('购买价格')
    )

    valid_from = models.DateField(null=True, blank=True, verbose_name=_('有效期开始'))
    valid_until = models.DateField(null=True, blank=True, verbose_name=_('有效期结束'))

    status = models.CharField(
        max_length=20,
        choices=AssetStatus.choices,
        default=AssetStatus.ACTIVE,
        verbose_name=_('状态')
    )

    description = models.TextField(blank=True, verbose_name=_('描述'))
    notes = models.TextField(blank=True, verbose_name=_('备注'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_intangible_assets',
        verbose_name=_('创建人')
    )

    class Meta:
        db_table = 'assets_intangible_asset'
        verbose_name = _('无形资产')
        verbose_name_plural = _('无形资产')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.name} ({self.get_asset_type_display()})"
