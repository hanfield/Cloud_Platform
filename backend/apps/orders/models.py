from django.db import models
from django.utils.translation import gettext_lazy as _
from apps.tenants.models import Tenant

class Order(models.Model):
    """订单模型"""
    STATUS_CHOICES = (
        ('pending', '待支付'),
        ('paid', '已支付'),
        ('cancelled', '已取消'),
        ('refunded', '已退款'),
        ('completed', '已完成'),
    )

    tenant = models.ForeignKey(Tenant, on_delete=models.CASCADE, related_name='orders', verbose_name='租户')
    order_no = models.CharField(max_length=64, unique=True, verbose_name='订单号')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending', verbose_name='状态')
    total_amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='总金额')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')
    paid_at = models.DateTimeField(null=True, blank=True, verbose_name='支付时间')
    
    class Meta:
        verbose_name = '订单'
        verbose_name_plural = verbose_name
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.order_no} - {self.tenant.name}"

class OrderItem(models.Model):
    """订单项模型"""
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items', verbose_name='订单')
    product_type = models.CharField(max_length=50, verbose_name='产品类型') # e.g., 'vm', 'disk', 'ip'
    product_name = models.CharField(max_length=100, verbose_name='产品名称')
    quantity = models.IntegerField(default=1, verbose_name='数量')
    price = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='单价')
    amount = models.DecimalField(max_digits=10, decimal_places=2, verbose_name='小计')
    config_data = models.JSONField(default=dict, verbose_name='配置信息') # Snapshot of config at purchase time

    class Meta:
        verbose_name = '订单项'
        verbose_name_plural = verbose_name

    def __str__(self):
        return f"{self.product_name} x {self.quantity}"
