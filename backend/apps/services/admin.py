"""
服务管理Admin配置
"""

from django.contrib import admin
from .models import Service, ServiceSubscription


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    """服务管理"""
    list_display = [
        'name', 'code', 'service_type', 'status', 'availability',
        'base_price', 'created_at'
    ]
    list_filter = ['service_type', 'status', 'availability', 'created_at']
    search_fields = ['name', 'code', 'description']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = [
        ('基本信息', {
            'fields': [
                'name', 'code', 'description', 'service_type', 'status'
            ]
        }),
        ('SLA指标', {
            'fields': [
                'availability', 'mttr', 'rpo', 'rto',
                'complaint_rate', 'network_availability'
            ]
        }),
        ('定价信息', {
            'fields': [
                'base_price', 'billing_unit', 'billing_period'
            ]
        }),
        ('其他信息', {
            'fields': [
                'features', 'specifications', 'service_level'
            ]
        }),
        ('审计信息', {
            'fields': [
                'created_at', 'updated_at', 'created_by'
            ]
        })
    ]


@admin.register(ServiceSubscription)
class ServiceSubscriptionAdmin(admin.ModelAdmin):
    """服务订阅管理"""
    list_display = [
        'tenant', 'service', 'contract', 'status',
        'unit_price', 'monthly_cost', 'start_date', 'end_date'
    ]
    list_filter = ['status', 'start_date', 'end_date']
    search_fields = ['tenant__name', 'service__name', 'contract__contract_number']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = [
        ('订阅信息', {
            'fields': [
                'tenant', 'service', 'contract', 'status'
            ]
        }),
        ('价格信息', {
            'fields': [
                'unit_price', 'discount_rate', 'monthly_cost'
            ]
        }),
        ('时间信息', {
            'fields': [
                'start_date', 'end_date'
            ]
        }),
        ('审计信息', {
            'fields': [
                'created_at', 'updated_at', 'created_by'
            ]
        })
    ]