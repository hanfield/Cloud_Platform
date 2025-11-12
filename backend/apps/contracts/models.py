"""
合同管理数据模型
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
import uuid


class Contract(models.Model):
    """合同模型"""

    # 合同状态选择
    class Status(models.TextChoices):
        DRAFT = 'draft', _('草稿')
        PENDING = 'pending', _('待审核')
        ACTIVE = 'active', _('生效中')
        SUSPENDED = 'suspended', _('暂停')
        TERMINATED = 'terminated', _('已终止')
        EXPIRED = 'expired', _('已过期')

    # 合同类型选择
    class ContractType(models.TextChoices):
        STANDARD = 'standard', _('标准合同')
        CUSTOM = 'custom', _('定制合同')
        TRIAL = 'trial', _('试用合同')
        UPGRADE = 'upgrade', _('升级合同')

    # 计费方式选择
    class BillingMethod(models.TextChoices):
        MONTHLY = 'monthly', _('按月计费')
        QUARTERLY = 'quarterly', _('按季度计费')
        YEARLY = 'yearly', _('按年计费')
        PAY_AS_USE = 'pay_as_use', _('按使用量计费')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract_number = models.CharField(max_length=100, unique=True, verbose_name=_('合同编号'))
    title = models.CharField(max_length=200, verbose_name=_('合同标题'))
    description = models.TextField(blank=True, verbose_name=_('合同描述'))

    # 关联租户
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='contracts',
        verbose_name=_('租户')
    )

    # 合同分类
    contract_type = models.CharField(
        max_length=20,
        choices=ContractType.choices,
        default=ContractType.STANDARD,
        verbose_name=_('合同类型')
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name=_('合同状态')
    )

    # 时间信息
    start_date = models.DateField(verbose_name=_('合同开始日期'))
    end_date = models.DateField(verbose_name=_('合同结束日期'))
    signed_date = models.DateField(blank=True, null=True, verbose_name=_('签署日期'))

    # 计费信息
    billing_method = models.CharField(
        max_length=20,
        choices=BillingMethod.choices,
        default=BillingMethod.MONTHLY,
        verbose_name=_('计费方式')
    )

    total_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('合同总金额')
    )

    paid_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name=_('已付金额')
    )

    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=1.0000,
        validators=[MinValueValidator(0), MinValueValidator(2)],
        verbose_name=_('折扣率'),
        help_text=_('1.0表示无折扣，0.9表示9折')
    )

    # 合同条款
    terms_and_conditions = models.TextField(blank=True, verbose_name=_('合同条款'))
    special_terms = models.TextField(blank=True, verbose_name=_('特殊条款'))

    # 联系人信息
    client_contact_person = models.CharField(max_length=100, verbose_name=_('客户联系人'))
    client_contact_phone = models.CharField(max_length=20, verbose_name=_('客户联系电话'))
    client_contact_email = models.EmailField(verbose_name=_('客户联系邮箱'))

    company_contact_person = models.CharField(max_length=100, verbose_name=_('我方联系人'))
    company_contact_phone = models.CharField(max_length=20, verbose_name=_('我方联系电话'))
    company_contact_email = models.EmailField(verbose_name=_('我方联系邮箱'))

    # 附件
    contract_file = models.FileField(
        upload_to='contracts/',
        blank=True,
        null=True,
        verbose_name=_('合同文件')
    )

    # 管理信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_contracts',
        verbose_name=_('创建者')
    )

    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_contracts',
        verbose_name=_('审批者')
    )

    approved_at = models.DateTimeField(blank=True, null=True, verbose_name=_('审批时间'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('合同')
        verbose_name_plural = _('合同')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.contract_number} - {self.title}"

    @property
    def remaining_amount(self):
        """剩余应付金额"""
        return self.total_amount - self.paid_amount

    @property
    def payment_progress(self):
        """付款进度（百分比）"""
        if self.total_amount == 0:
            return 100
        return float(self.paid_amount / self.total_amount * 100)

    @property
    def is_expired(self):
        """是否已过期"""
        from django.utils import timezone
        return timezone.now().date() > self.end_date

    @property
    def days_remaining(self):
        """剩余天数"""
        from django.utils import timezone
        today = timezone.now().date()
        if today > self.end_date:
            return 0
        return (self.end_date - today).days

    def calculate_discounted_amount(self, original_amount):
        """计算折扣后金额"""
        return original_amount * self.discount_rate


class ContractItem(models.Model):
    """合同项目明细"""

    class ItemType(models.TextChoices):
        VCPU = 'vcpu', _('虚拟CPU')
        MEMORY = 'memory', _('内存')
        STORAGE = 'storage', _('存储')
        NETWORK = 'network', _('网络')
        INSTANCE = 'instance', _('实例')
        LICENSE = 'license', _('许可证')
        SUPPORT = 'support', _('技术支持')
        OTHER = 'other', _('其他')

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name=_('合同')
    )

    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        verbose_name=_('项目类型')
    )

    name = models.CharField(max_length=200, verbose_name=_('项目名称'))
    description = models.TextField(blank=True, verbose_name=_('项目描述'))

    # 数量和单价
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('数量')
    )

    unit = models.CharField(max_length=50, verbose_name=_('单位'))

    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('单价')
    )

    # 计算字段
    subtotal = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('小计')
    )

    # 备注
    remarks = models.TextField(blank=True, verbose_name=_('备注'))

    class Meta:
        verbose_name = _('合同项目')
        verbose_name_plural = _('合同项目')
        ordering = ['id']

    def __str__(self):
        return f"{self.contract.contract_number} - {self.name}"

    def save(self, *args, **kwargs):
        """保存时自动计算小计"""
        self.subtotal = self.quantity * self.unit_price
        super().save(*args, **kwargs)


class ContractPayment(models.Model):
    """合同付款记录"""

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'bank_transfer', _('银行转账')
        CHECK = 'check', _('支票')
        CASH = 'cash', _('现金')
        ONLINE = 'online', _('在线支付')
        OTHER = 'other', _('其他')

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', _('待处理')
        CONFIRMED = 'confirmed', _('已确认')
        REJECTED = 'rejected', _('已拒绝')

    contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name='payments',
        verbose_name=_('合同')
    )

    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('付款金额')
    )

    payment_date = models.DateField(verbose_name=_('付款日期'))

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK_TRANSFER,
        verbose_name=_('付款方式')
    )

    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        verbose_name=_('付款状态')
    )

    reference_number = models.CharField(
        max_length=100,
        blank=True,
        verbose_name=_('付款参考号')
    )

    notes = models.TextField(blank=True, verbose_name=_('备注'))

    # 附件
    receipt_file = models.FileField(
        upload_to='payments/',
        blank=True,
        null=True,
        verbose_name=_('付款凭证')
    )

    # 管理信息
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='recorded_payments',
        verbose_name=_('记录人')
    )

    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='confirmed_payments',
        verbose_name=_('确认人')
    )

    confirmed_at = models.DateTimeField(blank=True, null=True, verbose_name=_('确认时间'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('记录时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('付款记录')
        verbose_name_plural = _('付款记录')
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.contract.contract_number} - ¥{self.amount}"


class ContractRenewal(models.Model):
    """合同续约记录"""

    class RenewalStatus(models.TextChoices):
        PENDING = 'pending', _('待处理')
        APPROVED = 'approved', _('已批准')
        REJECTED = 'rejected', _('已拒绝')
        COMPLETED = 'completed', _('已完成')

    original_contract = models.ForeignKey(
        Contract,
        on_delete=models.CASCADE,
        related_name='renewals',
        verbose_name=_('原合同')
    )

    new_contract = models.ForeignKey(
        Contract,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='renewal_from',
        verbose_name=_('新合同')
    )

    renewal_period_months = models.IntegerField(
        validators=[MinValueValidator(1)],
        verbose_name=_('续约期限(月)')
    )

    new_total_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('续约金额')
    )

    status = models.CharField(
        max_length=20,
        choices=RenewalStatus.choices,
        default=RenewalStatus.PENDING,
        verbose_name=_('续约状态')
    )

    renewal_reason = models.TextField(verbose_name=_('续约原因'))

    # 管理信息
    requested_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='requested_renewals',
        verbose_name=_('申请人')
    )

    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_renewals',
        verbose_name=_('审批人')
    )

    approved_at = models.DateTimeField(blank=True, null=True, verbose_name=_('审批时间'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('申请时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('合同续约')
        verbose_name_plural = _('合同续约')
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.original_contract.contract_number} - 续约{self.renewal_period_months}个月"