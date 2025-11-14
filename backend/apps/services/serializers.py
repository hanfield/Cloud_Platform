"""
服务管理序列化器
"""

from rest_framework import serializers
from .models import Service, ServiceSubscription
from apps.tenants.models import Tenant
from apps.contracts.models import Contract


class ServiceSerializer(serializers.ModelSerializer):
    """服务序列化器"""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    service_type_display = serializers.CharField(
        source='get_service_type_display', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    availability_display = serializers.CharField(
        source='get_availability_display', read_only=True
    )
    mttr_display = serializers.CharField(source='get_mttr_display', read_only=True)
    rpo_display = serializers.CharField(source='get_rpo_display', read_only=True)
    rto_display = serializers.CharField(source='get_rto_display', read_only=True)
    billing_unit_display = serializers.CharField(
        source='get_billing_unit_display', read_only=True
    )
    billing_period_display = serializers.CharField(
        source='get_billing_period_display', read_only=True
    )
    formatted_price = serializers.CharField(read_only=True)
    subscription_count = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = [
            'id', 'name', 'code', 'description', 'service_type', 'service_type_display',
            'status', 'status_display',
            'availability', 'availability_display', 'mttr', 'mttr_display',
            'rpo', 'rpo_display', 'rto', 'rto_display',
            'complaint_rate', 'network_availability',
            'base_price', 'billing_unit', 'billing_unit_display',
            'billing_period', 'billing_period_display',
            'features', 'specifications', 'service_level',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
            'formatted_price', 'subscription_count'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_subscription_count(self, obj):
        """获取服务订阅数量"""
        return obj.subscriptions.filter(
            status=ServiceSubscription.SubscriptionStatus.ACTIVE
        ).count()


class ServiceCreateSerializer(serializers.ModelSerializer):
    """服务创建序列化器"""

    class Meta:
        model = Service
        fields = [
            'name', 'code', 'description', 'service_type', 'status',
            'availability', 'mttr', 'rpo', 'rto', 'complaint_rate', 'network_availability',
            'base_price', 'billing_unit', 'billing_period',
            'features', 'specifications', 'service_level'
        ]

    def validate(self, attrs):
        """验证数据"""
        # 验证价格
        base_price = attrs.get('base_price', 0)
        if base_price < 0:
            raise serializers.ValidationError({"base_price": "基础价格不能为负数"})

        # 验证投诉率
        complaint_rate = attrs.get('complaint_rate', 0)
        if complaint_rate < 0 or complaint_rate > 1:
            raise serializers.ValidationError({
                "complaint_rate": "投诉率必须在0到1之间"
            })

        # 验证网络可用性
        network_availability = attrs.get('network_availability', 0)
        if network_availability < 0 or network_availability > 100:
            raise serializers.ValidationError({
                "network_availability": "网络可用性必须在0到100之间"
            })

        return attrs


class ServiceSubscriptionSerializer(serializers.ModelSerializer):
    """服务订阅序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    service_name = serializers.CharField(source='service.name', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = ServiceSubscription
        fields = [
            'id', 'tenant', 'tenant_name', 'service', 'service_name',
            'contract', 'contract_number', 'status', 'status_display',
            'unit_price', 'discount_rate', 'discount_percentage', 'monthly_cost',
            'start_date', 'end_date', 'created_at', 'updated_at',
            'created_by', 'created_by_name', 'is_active'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_discount_percentage(self, obj):
        """获取折扣百分比"""
        return int((1 - obj.discount_rate) * 100)


class ServiceSubscriptionCreateSerializer(serializers.ModelSerializer):
    """服务订阅创建序列化器"""

    class Meta:
        model = ServiceSubscription
        fields = [
            'tenant', 'service', 'contract', 'status',
            'unit_price', 'discount_rate', 'start_date', 'end_date'
        ]

    def validate(self, attrs):
        """验证数据"""
        tenant = attrs.get('tenant')
        service = attrs.get('service')
        contract = attrs.get('contract')
        unit_price = attrs.get('unit_price', 0)
        discount_rate = attrs.get('discount_rate', 1.0)
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        # 验证租户存在
        if tenant and not Tenant.objects.filter(id=tenant.id).exists():
            raise serializers.ValidationError({"tenant": "租户不存在"})

        # 验证服务存在
        if service and not Service.objects.filter(id=service.id).exists():
            raise serializers.ValidationError({"service": "服务不存在"})

        # 验证合同存在
        if contract and not Contract.objects.filter(id=contract.id).exists():
            raise serializers.ValidationError({"contract": "合同不存在"})

        # 验证价格
        if unit_price < 0:
            raise serializers.ValidationError({"unit_price": "单价不能为负数"})

        # 验证折扣率
        if discount_rate < 0 or discount_rate > 1:
            raise serializers.ValidationError({
                "discount_rate": "折扣率必须在0到1之间"
            })

        # 验证日期
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError({
                "end_date": "结束日期必须大于开始日期"
            })

        return attrs


class ServiceStatisticsSerializer(serializers.Serializer):
    """服务统计序列化器"""

    total_services = serializers.IntegerField()
    active_services = serializers.IntegerField()
    inactive_services = serializers.IntegerField()
    draft_services = serializers.IntegerField()
    service_types = serializers.DictField()
    availability_levels = serializers.DictField()


class SubscriptionStatisticsSerializer(serializers.Serializer):
    """订阅统计序列化器"""

    total_subscriptions = serializers.IntegerField()
    active_subscriptions = serializers.IntegerField()
    suspended_subscriptions = serializers.IntegerField()
    terminated_subscriptions = serializers.IntegerField()
    subscription_by_service = serializers.DictField()
    subscription_by_tenant = serializers.DictField()