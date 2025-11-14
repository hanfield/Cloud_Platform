"""
租户管理后台配置
"""

from django.contrib import admin
from .models import Tenant, TenantResourceUsage, TenantOperationLog
from .user_models import UserProfile


@admin.register(Tenant)
class TenantAdmin(admin.ModelAdmin):
    """租户管理后台"""

    list_display = [
        'name', 'code', 'level', 'discount_level', 'tenant_type',
        'status', 'contact_person', 'start_time', 'end_time', 'created_at'
    ]

    list_filter = [
        'level', 'discount_level', 'tenant_type', 'status',
        'created_at', 'start_time', 'end_time'
    ]

    search_fields = ['name', 'code', 'contact_person', 'contact_email']

    readonly_fields = ['id', 'created_at', 'updated_at', 'discount_rate', 'is_active']

    fieldsets = (
        ('基本信息', {
            'fields': ('id', 'name', 'code', 'description')
        }),
        ('租户分类', {
            'fields': ('level', 'discount_level', 'tenant_type', 'status')
        }),
        ('联系信息', {
            'fields': ('contact_person', 'contact_phone', 'contact_email', 'address')
        }),
        ('时间信息', {
            'fields': ('start_time', 'end_time', 'created_at', 'updated_at')
        }),
        ('管理信息', {
            'fields': ('created_by', 'openstack_project_id')
        }),
        ('资源配额', {
            'fields': (
                'quota_vcpus', 'quota_memory', 'quota_disk',
                'quota_instances', 'quota_networks', 'quota_floating_ips'
            )
        }),
        ('计算属性', {
            'fields': ('discount_rate', 'is_active'),
            'classes': ('collapse',)
        })
    )

    date_hierarchy = 'created_at'

    def save_model(self, request, obj, form, change):
        """保存时设置创建者"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(TenantResourceUsage)
class TenantResourceUsageAdmin(admin.ModelAdmin):
    """租户资源使用情况管理后台"""

    list_display = [
        'tenant', 'used_vcpus', 'used_memory', 'used_disk',
        'used_instances', 'monthly_cost', 'record_date'
    ]

    list_filter = ['tenant', 'record_date']

    search_fields = ['tenant__name', 'tenant__code']

    readonly_fields = ['record_date']

    date_hierarchy = 'record_date'


@admin.register(TenantOperationLog)
class TenantOperationLogAdmin(admin.ModelAdmin):
    """租户操作日志管理后台"""

    list_display = [
        'tenant', 'operation_type', 'operator', 'operation_time'
    ]

    list_filter = ['operation_type', 'operation_time']

    search_fields = ['tenant__name', 'operator__username', 'operation_detail']

    readonly_fields = ['operation_time']

    date_hierarchy = 'operation_time'

    def has_add_permission(self, request):
        """禁止添加操作日志"""
        return False

    def has_change_permission(self, request, obj=None):
        """禁止修改操作日志"""
        return False


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    """用户配置管理后台"""

    list_display = [
        'user', 'user_type', 'tenant', 'status', 'phone', 'created_at'
    ]

    list_filter = ['user_type', 'status', 'created_at']

    search_fields = ['user__username', 'user__email', 'phone', 'tenant__name']

    readonly_fields = ['created_at', 'updated_at']

    fieldsets = (
        ('用户信息', {
            'fields': ('user', 'user_type', 'status')
        }),
        ('租户关联', {
            'fields': ('tenant',)
        }),
        ('个人信息', {
            'fields': ('phone', 'department', 'position')
        }),
        ('时间信息', {
            'fields': ('created_at', 'updated_at')
        })
    )

    date_hierarchy = 'created_at'