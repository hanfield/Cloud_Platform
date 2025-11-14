"""
用户扩展模型
"""

from django.db import models
from django.contrib.auth.models import User
from django.utils.translation import gettext_lazy as _
from .models import Tenant


class UserProfile(models.Model):
    """用户配置文件模型"""

    class UserType(models.TextChoices):
        ADMIN = 'admin', _('管理员')
        TENANT = 'tenant', _('租户用户')

    class UserStatus(models.TextChoices):
        PENDING = 'pending', _('待审核')
        ACTIVE = 'active', _('已激活')
        SUSPENDED = 'suspended', _('已暂停')
        REJECTED = 'rejected', _('已拒绝')

    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name='profile',
        verbose_name=_('用户')
    )

    user_type = models.CharField(
        max_length=20,
        choices=UserType.choices,
        default=UserType.TENANT,
        verbose_name=_('用户类型')
    )

    tenant = models.ForeignKey(
        Tenant,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='users',
        verbose_name=_('所属租户')
    )

    status = models.CharField(
        max_length=20,
        choices=UserStatus.choices,
        default=UserStatus.PENDING,
        verbose_name=_('用户状态')
    )

    phone = models.CharField(max_length=20, blank=True, verbose_name=_('手机号'))
    department = models.CharField(max_length=100, blank=True, verbose_name=_('部门'))
    position = models.CharField(max_length=100, blank=True, verbose_name=_('职位'))

    created_at = models.DateTimeField(auto_now_add=True, verbose_name=_('创建时间'))
    updated_at = models.DateTimeField(auto_now=True, verbose_name=_('更新时间'))

    class Meta:
        verbose_name = _('用户配置')
        verbose_name_plural = _('用户配置')
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.user.username} - {self.get_user_type_display()}'

    @property
    def is_admin(self):
        """是否是管理员"""
        return self.user_type == self.UserType.ADMIN

    @property
    def is_tenant_user(self):
        """是否是租户用户"""
        return self.user_type == self.UserType.TENANT

    @property
    def is_active(self):
        """是否已激活"""
        return self.status == self.UserStatus.ACTIVE and self.user.is_active