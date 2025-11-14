"""
租户管理数据模型
"""

from django.db import (models)
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
import uuid
import json
from cryptography.fernet import Fernet
from django.conf import settings
from django.core.exceptions import ImproperlyConfigured


class Tenant(models.Model):
    """租户模型"""

    # 租户级别选择
    class TenantLevel(models.TextChoices):
        SUPERIOR = 'superior', _('上级单位')
        IMPORTANT = 'important', _('重要客户')
        ORDINARY = 'ordinary', _('普通客户')

    # 折扣级别选择
    class DiscountLevel(models.TextChoices):
        LEVEL_A = 'level_a', _('A级(9折)')
        LEVEL_B = 'level_b', _('B级(8.5折)')
        LEVEL_C = 'level_c', _('C级(8折)')
        LEVEL_D = 'level_d', _('D级(7.5折)')
        LEVEL_E = 'level_e', _('E级(7折)')
        LEVEL_F = 'level_f', _('F级(6.5折)')
        NO_DISCOUNT = 'no_discount', _('无折扣')

    # 租户类型选择
    class TenantType(models.TextChoices):
        VIRTUAL = 'virtual', _('虚拟资源')
        VIRTUAL_PHYSICAL = 'virtual_physical', _('虚拟+物理资源')
        VIRTUAL_PHYSICAL_NETWORK = 'virtual_physical_network', _('虚拟+物理+网络线路资源')
        DATACENTER_CABINET = 'datacenter_cabinet', _('机房机柜资源')

    # 状态选择
    class Status(models.TextChoices):
        ACTIVE = 'active', _('活跃')
        SUSPENDED = 'suspended', _('暂停')
        TERMINATED = 'terminated', _('终止')
        PENDING = 'pending', _('待审核')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.CharField(max_length=200, verbose_name=_('租户名称'), unique=True)
    code = models.CharField(max_length=50, verbose_name=_('租户编码'), unique=True)
    description = models.TextField(blank=True, verbose_name=_('描述'))

    # 租户分类
    level = models.CharField(
        max_length=20,
        choices=TenantLevel.choices,
        default=TenantLevel.ORDINARY,
        verbose_name=_('租户级别')
    )

    discount_level = models.CharField(
        max_length=20,
        choices=DiscountLevel.choices,
        default=DiscountLevel.NO_DISCOUNT,
        verbose_name=_('折扣级别')
    )

    tenant_type = models.CharField(
        max_length=30,
        choices=TenantType.choices,
        default=TenantType.VIRTUAL,
        verbose_name=_('租户类型')
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name=_('状态')
    )

    # 联系信息
    contact_person = models.CharField(max_length=100, verbose_name=_('联系人'))
    contact_phone = models.CharField(max_length=20, verbose_name=_('联系电话'))
    contact_email = models.EmailField(verbose_name=_('联系邮箱'))
    address = models.TextField(blank=True, verbose_name=_('地址'))

    # 时间信息
    start_time = models.DateTimeField(verbose_name=_('开始时间'))
    end_time = models.DateTimeField(verbose_name=_('结束时间'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    # 管理信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_tenants',
        verbose_name=_('创建者')
    )

    # OpenStack相关
    openstack_project_id = models.CharField(
        max_length=100,
        blank=True,
        null=True,
        verbose_name=_('OpenStack项目ID')
    )

    # 资源配额
    quota_vcpus = models.IntegerField(default=0, verbose_name=_('vCPU配额'))
    quota_memory = models.IntegerField(default=0, verbose_name=_('内存配额(GB)'))
    quota_disk = models.IntegerField(default=0, verbose_name=_('磁盘配额(GB)'))
    quota_instances = models.IntegerField(default=0, verbose_name=_('实例配额'))
    quota_networks = models.IntegerField(default=0, verbose_name=_('网络配额'))
    quota_floating_ips = models.IntegerField(default=0, verbose_name=_('浮动IP配额'))

    class Meta:
        verbose_name = _('租户')
        verbose_name_plural = _('租户')
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    @property
    def is_active(self):
        """检查租户是否活跃"""
        return self.status == self.Status.ACTIVE

    @property
    def discount_rate(self):
        """获取折扣率"""
        discount_mapping = {
            self.DiscountLevel.LEVEL_A: 0.9,
            self.DiscountLevel.LEVEL_B: 0.85,
            self.DiscountLevel.LEVEL_C: 0.8,
            self.DiscountLevel.LEVEL_D: 0.75,
            self.DiscountLevel.LEVEL_E: 0.7,
            self.DiscountLevel.LEVEL_F: 0.65,
            self.DiscountLevel.NO_DISCOUNT: 1.0,
        }
        return discount_mapping.get(self.discount_level, 1.0)


class TenantResourceUsage(models.Model):
    """租户资源使用情况"""

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='resource_usage')

    # 实际使用量
    used_vcpus = models.IntegerField(default=0, verbose_name=_('已使用vCPU'))
    used_memory = models.IntegerField(default=0, verbose_name=_('已使用内存(GB)'))
    used_disk = models.IntegerField(default=0, verbose_name=_('已使用磁盘(GB)'))
    used_instances = models.IntegerField(default=0, verbose_name=_('已使用实例'))
    used_networks = models.IntegerField(default=0, verbose_name=_('已使用网络'))
    used_floating_ips = models.IntegerField(default=0, verbose_name=_('已使用浮动IP'))

    # 计费相关
    monthly_cost = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name=_('月费用')
    )

    # 时间记录
    record_date = models.DateTimeField(auto_now_add=True, verbose_name=_('记录时间'))

    class Meta:
        verbose_name = _('租户资源使用情况')
        verbose_name_plural = _('租户资源使用情况')
        ordering = ['-record_date']

    def __str__(self):
        return f'{self.tenant.name} - {self.record_date.strftime("%Y-%m-%d")}'


class TenantOperationLog(models.Model):
    """租户操作日志"""

    class OperationType(models.TextChoices):
        CREATE = 'create', _('创建')
        UPDATE = 'update', _('更新')
        DELETE = 'delete', _('删除')
        SUSPEND = 'suspend', _('暂停')
        ACTIVATE = 'activate', _('激活')
        TERMINATE = 'terminate', _('终止')

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='operation_logs')
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
        verbose_name = _('租户操作日志')
        verbose_name_plural = _('租户操作日志')
        ordering = ['-operation_time']

    def __str__(self):
        return f'{self.tenant.name} - {self.get_operation_type_display()}'


class Stakeholder(models.Model):
    """干系人模型"""

    class StakeholderType(models.TextChoices):
        CUSTOMER = 'customer', _('客户')
        DELIVERY_TEAM = 'delivery_team', _('项目交付团队')
        OPERATION_TEAM = 'operation_team', _('运维团队')

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='stakeholders')
    stakeholder_type = models.CharField(
        max_length=20,
        choices=StakeholderType.choices,
        verbose_name=_('干系人类型')
    )
    name = models.CharField(max_length=100, verbose_name=_('姓名'))
    phone_encrypted = models.TextField(verbose_name=_('加密电话号码'))
    email_encrypted = models.TextField(verbose_name=_('加密邮箱'))
    position = models.CharField(max_length=100, blank=True, verbose_name=_('职位'))
    department = models.CharField(max_length=100, blank=True, verbose_name=_('部门'))
    is_primary = models.BooleanField(default=False, verbose_name=_('主要联系人'))
    notes = models.TextField(blank=True, verbose_name=_('备注'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('干系人')
        verbose_name_plural = _('干系人')
        ordering = ['tenant', 'stakeholder_type', 'is_primary', '-name']

    def __str__(self):
        return f'{self.name} - {self.get_stakeholder_type_display()}'

    @property
    def phone(self):
        """解密电话号码"""
        return self._decrypt_field(self.phone_encrypted)

    @phone.setter
    def phone(self, value):
        """加密电话号码"""
        self.phone_encrypted = self._encrypt_field(value)

    @property
    def email(self):
        """解密邮箱"""
        return self._decrypt_field(self.email_encrypted)

    @email.setter
    def email(self, value):
        """加密邮箱"""
        self.email_encrypted = self._encrypt_field(value)

    def _get_encryption_key(self):
        """获取加密密钥"""
        if not hasattr(settings, 'ENCRYPTION_KEY'):
            raise ImproperlyConfigured('ENCRYPTION_KEY must be set in settings')
        return settings.ENCRYPTION_KEY

    def _encrypt_field(self, value):
        """加密字段"""
        if not value:
            return ''
        fernet = Fernet(self._get_encryption_key())
        return fernet.encrypt(value.encode()).decode()

    def _decrypt_field(self, encrypted_value):
        """解密字段"""
        if not encrypted_value:
            return ''
        fernet = Fernet(self._get_encryption_key())
        return fernet.decrypt(encrypted_value.encode()).decode()


class DataCenter(models.Model):
    """数据中心模型"""

    class DataCenterType(models.TextChoices):
        PRODUCTION = 'production', _('生产中心')
        SAME_CITY = 'same_city', _('同城灾备')
        DIFFERENT_CITY = 'different_city', _('异地灾备')

    name = models.CharField(max_length=100, verbose_name=_('数据中心名称'))
    code = models.CharField(max_length=50, unique=True, verbose_name=_('数据中心代码'))
    data_center_type = models.CharField(
        max_length=20,
        choices=DataCenterType.choices,
        verbose_name=_('数据中心类型')
    )
    location = models.CharField(max_length=200, verbose_name=_('位置'))
    description = models.TextField(blank=True, verbose_name=_('描述'))
    is_active = models.BooleanField(default=True, verbose_name=_('是否启用'))
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('数据中心')
        verbose_name_plural = _('数据中心')
        ordering = ['data_center_type', 'name']

    def __str__(self):
        return f'{self.name} ({self.get_data_center_type_display()})'



