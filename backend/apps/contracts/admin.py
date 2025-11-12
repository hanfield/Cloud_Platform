"""
合同管理后台配置
"""

from django.contrib import admin
from .models import Contract, ContractItem, ContractPayment, ContractRenewal


class ContractItemInline(admin.TabularInline):
    """合同项目内联编辑"""
    model = ContractItem
    extra = 1


class ContractPaymentInline(admin.TabularInline):
    """付款记录内联编辑"""
    model = ContractPayment
    extra = 0
    readonly_fields = ['created_at']


@admin.register(Contract)
class ContractAdmin(admin.ModelAdmin):
    """合同管理后台"""

    list_display = [
        'contract_number', 'title', 'tenant', 'contract_type', 'status',
        'total_amount', 'paid_amount', 'remaining_amount',
        'start_date', 'end_date', 'created_at'
    ]

    list_filter = [
        'contract_type', 'status', 'billing_method',
        'created_at', 'start_date', 'end_date'
    ]

    search_fields = [
        'contract_number', 'title', 'tenant__name',
        'client_contact_person', 'company_contact_person'
    ]

    readonly_fields = [
        'id', 'remaining_amount', 'payment_progress',
        'is_expired', 'days_remaining', 'created_at', 'updated_at'
    ]

    fieldsets = (
        ('基本信息', {
            'fields': ('id', 'contract_number', 'title', 'description', 'tenant')
        }),
        ('合同分类', {
            'fields': ('contract_type', 'status', 'billing_method')
        }),
        ('时间信息', {
            'fields': ('start_date', 'end_date', 'signed_date')
        }),
        ('财务信息', {
            'fields': (
                'total_amount', 'paid_amount', 'discount_rate',
                'remaining_amount', 'payment_progress'
            )
        }),
        ('合同条款', {
            'fields': ('terms_and_conditions', 'special_terms'),
            'classes': ('collapse',)
        }),
        ('客户联系信息', {
            'fields': (
                'client_contact_person', 'client_contact_phone', 'client_contact_email'
            )
        }),
        ('我方联系信息', {
            'fields': (
                'company_contact_person', 'company_contact_phone', 'company_contact_email'
            )
        }),
        ('附件', {
            'fields': ('contract_file',)
        }),
        ('审批信息', {
            'fields': ('approved_by', 'approved_at'),
            'classes': ('collapse',)
        }),
        ('管理信息', {
            'fields': ('created_by', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
        ('状态信息', {
            'fields': ('is_expired', 'days_remaining'),
            'classes': ('collapse',)
        })
    )

    inlines = [ContractItemInline, ContractPaymentInline]

    date_hierarchy = 'created_at'

    def save_model(self, request, obj, form, change):
        """保存时设置创建者"""
        if not change:
            obj.created_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ContractItem)
class ContractItemAdmin(admin.ModelAdmin):
    """合同项目管理后台"""

    list_display = [
        'contract', 'name', 'item_type', 'quantity', 'unit',
        'unit_price', 'subtotal'
    ]

    list_filter = ['item_type', 'contract__contract_type']

    search_fields = ['name', 'contract__contract_number', 'contract__title']

    readonly_fields = ['subtotal']


@admin.register(ContractPayment)
class ContractPaymentAdmin(admin.ModelAdmin):
    """付款记录管理后台"""

    list_display = [
        'contract', 'amount', 'payment_date', 'payment_method',
        'status', 'recorded_by', 'confirmed_by'
    ]

    list_filter = ['payment_method', 'status', 'payment_date']

    search_fields = [
        'contract__contract_number', 'reference_number', 'notes'
    ]

    readonly_fields = ['created_at', 'updated_at', 'confirmed_at']

    date_hierarchy = 'payment_date'

    def save_model(self, request, obj, form, change):
        """保存时设置记录人"""
        if not change:
            obj.recorded_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ContractRenewal)
class ContractRenewalAdmin(admin.ModelAdmin):
    """合同续约管理后台"""

    list_display = [
        'original_contract', 'renewal_period_months', 'new_total_amount',
        'status', 'requested_by', 'approved_by', 'created_at'
    ]

    list_filter = ['status', 'created_at', 'approved_at']

    search_fields = [
        'original_contract__contract_number', 'renewal_reason'
    ]

    readonly_fields = ['created_at', 'updated_at', 'approved_at']

    date_hierarchy = 'created_at'

    def save_model(self, request, obj, form, change):
        """保存时设置申请人"""
        if not change:
            obj.requested_by = request.user
        super().save_model(request, obj, form, change)