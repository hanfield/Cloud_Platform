"""
账单和订单管理数据模型
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from django.core.validators import MinValueValidator
from django.utils import timezone
from decimal import Decimal
import uuid
from datetime import date, timedelta


class MonthlyBill(models.Model):
    """月度账单模型"""

    class BillStatus(models.TextChoices):
        DRAFT = 'draft', _('草稿')
        PENDING = 'pending', _('待支付')
        PARTIAL_PAID = 'partial_paid', _('部分支付')
        PAID = 'paid', _('已支付')
        OVERDUE = 'overdue', _('已逾期')
        CANCELLED = 'cancelled', _('已取消')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bill_number = models.CharField(max_length=100, unique=True, verbose_name=_('账单编号'))

    # 关联租户
    tenant = models.ForeignKey(
        'tenants.Tenant',
        on_delete=models.CASCADE,
        related_name='monthly_bills',
        verbose_name=_('租户')
    )

    # 账期信息
    billing_year = models.IntegerField(verbose_name=_('账期年份'))
    billing_month = models.IntegerField(verbose_name=_('账期月份'))
    billing_period_start = models.DateField(verbose_name=_('账期开始日期'))
    billing_period_end = models.DateField(verbose_name=_('账期结束日期'))

    # 费用信息
    total_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name=_('账单总金额')
    )

    paid_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name=_('已支付金额')
    )

    discount_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name=_('折扣金额')
    )

    # 状态
    status = models.CharField(
        max_length=20,
        choices=BillStatus.choices,
        default=BillStatus.DRAFT,
        verbose_name=_('账单状态')
    )

    # 时间信息
    due_date = models.DateField(verbose_name=_('到期日期'))
    generated_at = models.DateTimeField(auto_now_add=True, verbose_name=_('生成时间'))
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name=_('支付完成时间'))

    # 备注
    notes = models.TextField(blank=True, verbose_name=_('备注'))

    # 创建信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('月度账单')
        verbose_name_plural = _('月度账单')
        ordering = ['-billing_year', '-billing_month']
        unique_together = ['tenant', 'billing_year', 'billing_month']

    def __str__(self):
        return f"{self.tenant.name} - {self.billing_year}年{self.billing_month}月账单"

    @property
    def remaining_amount(self):
        """剩余应付金额"""
        return self.total_amount - self.paid_amount

    @property
    def is_overdue(self):
        """是否逾期"""
        return date.today() > self.due_date and self.status not in ['paid', 'cancelled']

    @property
    def payment_progress(self):
        """付款进度（百分比）"""
        if self.total_amount == 0:
            return 100
        return float(self.paid_amount / self.total_amount * 100)

    def calculate_current_month_amount(self, query_date=None):
        """
        计算当月应收费用（截至查询日期前一日）
        如10日显示1至9日，25日显示1至24日
        """
        if query_date is None:
            query_date = date.today()

        # 计算截止日期（查询日期的前一日）
        end_date = query_date - timedelta(days=1)

        # 如果查询日期是当月第一天，则没有应收费用
        if end_date.month != self.billing_month or end_date.year != self.billing_year:
            return Decimal('0.00')

        # 获取该月的所有账单明细
        items = self.items.filter(
            billing_date__gte=self.billing_period_start,
            billing_date__lte=end_date
        )

        # 累计费用
        total = sum([item.amount for item in items])
        return total

    def save(self, *args, **kwargs):
        """保存时自动生成账单编号"""
        if not self.bill_number:
            # 生成账单编号格式: BILL-YYYYMM-租户编号-序号
            prefix = f"BILL-{self.billing_year}{self.billing_month:02d}-{self.tenant.code}"
            # 查找同月同租户的账单数量
            count = MonthlyBill.objects.filter(
                tenant=self.tenant,
                billing_year=self.billing_year,
                billing_month=self.billing_month
            ).count()
            self.bill_number = f"{prefix}-{count + 1:04d}"

        super().save(*args, **kwargs)


class BillItem(models.Model):
    """账单明细"""

    class ItemType(models.TextChoices):
        COMPUTE = 'compute', _('计算资源')
        STORAGE = 'storage', _('存储资源')
        NETWORK = 'network', _('网络资源')
        DATABASE = 'database', _('数据库资源')
        PRODUCT = 'product', _('产品订阅')
        SERVICE = 'service', _('服务订阅')
        OTHER = 'other', _('其他费用')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # 关联账单
    bill = models.ForeignKey(
        MonthlyBill,
        on_delete=models.CASCADE,
        related_name='items',
        verbose_name=_('月度账单')
    )

    # 明细类型
    item_type = models.CharField(
        max_length=20,
        choices=ItemType.choices,
        verbose_name=_('费用类型')
    )

    # 明细信息
    name = models.CharField(max_length=200, verbose_name=_('费用项名称'))
    description = models.TextField(blank=True, verbose_name=_('费用描述'))

    # 关联对象（可选）
    information_system = models.ForeignKey(
        'information_systems.InformationSystem',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='bill_items',
        verbose_name=_('关联信息系统')
    )

    # 计费信息
    billing_date = models.DateField(verbose_name=_('计费日期'))
    quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=1,
        validators=[MinValueValidator(0)],
        verbose_name=_('数量')
    )
    unit = models.CharField(max_length=50, verbose_name=_('单位'))
    unit_price = models.DecimalField(
        max_digits=10,
        decimal_places=4,
        validators=[MinValueValidator(0)],
        verbose_name=_('单价')
    )
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('金额')
    )

    # 折扣
    discount_rate = models.DecimalField(
        max_digits=5,
        decimal_places=4,
        default=1.0000,
        verbose_name=_('折扣率')
    )
    discount_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        default=0,
        validators=[MinValueValidator(0)],
        verbose_name=_('折扣金额')
    )
    final_amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('最终金额')
    )

    # 时间信息
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))

    class Meta:
        verbose_name = _('账单明细')
        verbose_name_plural = _('账单明细')
        ordering = ['billing_date', 'created_at']

    def __str__(self):
        return f"{self.bill.bill_number} - {self.name}"

    def save(self, *args, **kwargs):
        """保存时自动计算金额"""
        self.amount = self.quantity * self.unit_price
        self.discount_amount = self.amount * (1 - self.discount_rate)
        self.final_amount = self.amount - self.discount_amount
        super().save(*args, **kwargs)




class Payment(models.Model):
    """支付记录"""

    class PaymentMethod(models.TextChoices):
        BANK_TRANSFER = 'bank_transfer', _('银行转账')
        ALIPAY = 'alipay', _('支付宝')
        WECHAT = 'wechat', _('微信支付')
        CHECK = 'check', _('支票')
        CASH = 'cash', _('现金')
        OTHER = 'other', _('其他')

    class PaymentStatus(models.TextChoices):
        PENDING = 'pending', _('待确认')
        CONFIRMED = 'confirmed', _('已确认')
        FAILED = 'failed', _('失败')
        REFUNDED = 'refunded', _('已退款')

    # 基本信息
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    payment_number = models.CharField(max_length=100, unique=True, verbose_name=_('支付编号'))

    # 关联订单或账单
    order = models.ForeignKey(
        'orders.Order',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name=_('订单')
    )

    bill = models.ForeignKey(
        MonthlyBill,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='payments',
        verbose_name=_('账单')
    )

    # 支付信息
    amount = models.DecimalField(
        max_digits=15,
        decimal_places=2,
        validators=[MinValueValidator(0)],
        verbose_name=_('支付金额')
    )

    payment_method = models.CharField(
        max_length=20,
        choices=PaymentMethod.choices,
        default=PaymentMethod.BANK_TRANSFER,
        verbose_name=_('支付方式')
    )

    status = models.CharField(
        max_length=20,
        choices=PaymentStatus.choices,
        default=PaymentStatus.PENDING,
        verbose_name=_('支付状态')
    )

    # 支付详情
    payment_date = models.DateTimeField(default=timezone.now, verbose_name=_('支付时间'))
    transaction_id = models.CharField(max_length=200, blank=True, verbose_name=_('交易流水号'))
    payer_account = models.CharField(max_length=200, blank=True, verbose_name=_('付款账号'))

    # 附件
    receipt_file = models.FileField(
        upload_to='payments/',
        blank=True,
        null=True,
        verbose_name=_('支付凭证')
    )

    # 备注
    notes = models.TextField(blank=True, verbose_name=_('备注'))

    # 确认信息
    confirmed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='billing_confirmed_payments',
        verbose_name=_('确认人')
    )
    confirmed_at = models.DateTimeField(null=True, blank=True, verbose_name=_('确认时间'))

    # 创建信息
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='billing_created_payments',
        verbose_name=_('创建者')
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('支付记录')
        verbose_name_plural = _('支付记录')
        ordering = ['-payment_date']

    def __str__(self):
        return f"{self.payment_number} - ¥{self.amount}"

    def save(self, *args, **kwargs):
        """保存时自动生成支付编号"""
        if not self.payment_number:
            # 生成支付编号格式: PAY-YYYYMMDDHHMMSS-序号
            now = timezone.now()
            prefix = f"PAY-{now.strftime('%Y%m%d%H%M%S')}"
            count = Payment.objects.filter(
                created_at__year=now.year,
                created_at__month=now.month,
                created_at__day=now.day
            ).count()
            self.payment_number = f"{prefix}-{count + 1:04d}"

        super().save(*args, **kwargs)
