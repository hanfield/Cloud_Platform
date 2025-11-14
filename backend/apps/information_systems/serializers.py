"""
信息系统管理序列化器
"""

from rest_framework import serializers
from .models import (
    InformationSystem,
    SystemResource,
    SystemOperationLog,
    SystemBillingRecord
)
from apps.tenants.models import Tenant


class InformationSystemSerializer(serializers.ModelSerializer):
    """信息系统序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    running_time = serializers.SerializerMethodField()
    monthly_cost = serializers.SerializerMethodField()

    class Meta:
        model = InformationSystem
        fields = [
            'id', 'name', 'code', 'description', 'system_type', 'operation_mode', 'status',
            'tenant', 'tenant_name', 'service_content', 'product_content',
            'total_cpu', 'total_memory', 'total_storage',
            'created_at', 'updated_at', 'last_start_time', 'last_stop_time',
            'created_by', 'created_by_name', 'running_time', 'monthly_cost'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_running_time(self, obj):
        """获取运行时间"""
        return obj.running_time

    def get_monthly_cost(self, obj):
        """获取月费用"""
        return obj.monthly_cost


class InformationSystemCreateSerializer(serializers.ModelSerializer):
    """信息系统创建序列化器"""

    class Meta:
        model = InformationSystem
        fields = [
            'name', 'code', 'description', 'system_type', 'operation_mode', 'status',
            'tenant', 'service_content', 'product_content',
            'total_cpu', 'total_memory', 'total_storage'
        ]

    def validate(self, attrs):
        """验证数据"""
        # 验证租户是否存在
        tenant = attrs.get('tenant')
        if tenant and not Tenant.objects.filter(id=tenant.id).exists():
            raise serializers.ValidationError({"tenant": "租户不存在"})

        # 验证资源数量
        total_cpu = attrs.get('total_cpu', 0)
        total_memory = attrs.get('total_memory', 0)
        total_storage = attrs.get('total_storage', 0)

        if total_cpu < 0:
            raise serializers.ValidationError({"total_cpu": "CPU数量不能为负数"})
        if total_memory < 0:
            raise serializers.ValidationError({"total_memory": "内存数量不能为负数"})
        if total_storage < 0:
            raise serializers.ValidationError({"total_storage": "存储数量不能为负数"})

        return attrs


class SystemResourceSerializer(serializers.ModelSerializer):
    """系统资源序列化器"""

    information_system_name = serializers.CharField(
        source='information_system.name', read_only=True
    )
    running_time_display = serializers.SerializerMethodField()

    class Meta:
        model = SystemResource
        fields = [
            'id', 'information_system', 'information_system_name', 'name',
            'resource_type', 'status', 'region', 'ip_address',
            'cpu_cores', 'memory_gb', 'storage_gb',
            'openstack_resource_id', 'openstack_resource_type',
            'created_at', 'updated_at', 'start_time', 'running_time',
            'running_time_display'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_running_time_display(self, obj):
        """格式化运行时间显示"""
        if obj.running_time:
            # 将timedelta转换为可读格式
            total_seconds = int(obj.running_time.total_seconds())
            days = total_seconds // 86400
            hours = (total_seconds % 86400) // 3600
            minutes = (total_seconds % 3600) // 60
            seconds = total_seconds % 60

            if days > 0:
                return f"{days}天{hours}小时{minutes}分钟"
            elif hours > 0:
                return f"{hours}小时{minutes}分钟"
            elif minutes > 0:
                return f"{minutes}分钟{seconds}秒"
            else:
                return f"{seconds}秒"
        return ""


class SystemResourceCreateSerializer(serializers.ModelSerializer):
    """系统资源创建序列化器"""

    class Meta:
        model = SystemResource
        fields = [
            'information_system', 'name', 'resource_type', 'status',
            'region', 'ip_address', 'cpu_cores', 'memory_gb', 'storage_gb',
            'openstack_resource_id', 'openstack_resource_type'
        ]

    def validate(self, attrs):
        """验证数据"""
        # 验证资源规格
        cpu_cores = attrs.get('cpu_cores', 0)
        memory_gb = attrs.get('memory_gb', 0)
        storage_gb = attrs.get('storage_gb', 0)

        if cpu_cores < 0:
            raise serializers.ValidationError({"cpu_cores": "CPU核数不能为负数"})
        if memory_gb < 0:
            raise serializers.ValidationError({"memory_gb": "内存大小不能为负数"})
        if storage_gb < 0:
            raise serializers.ValidationError({"storage_gb": "存储容量不能为负数"})

        return attrs


class SystemOperationLogSerializer(serializers.ModelSerializer):
    """系统操作日志序列化器"""

    information_system_name = serializers.CharField(
        source='information_system.name', read_only=True
    )
    operator_name = serializers.CharField(source='operator.username', read_only=True)
    operation_type_display = serializers.CharField(
        source='get_operation_type_display', read_only=True
    )

    class Meta:
        model = SystemOperationLog
        fields = [
            'id', 'information_system', 'information_system_name',
            'operation_type', 'operation_type_display', 'operation_detail',
            'operator', 'operator_name', 'operation_time'
        ]
        read_only_fields = ['operation_time']


class SystemBillingRecordSerializer(serializers.ModelSerializer):
    """系统计费记录序列化器"""

    information_system_name = serializers.CharField(
        source='information_system.name', read_only=True
    )
    billing_period_display = serializers.SerializerMethodField()
    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = SystemBillingRecord
        fields = [
            'id', 'information_system', 'information_system_name',
            'billing_period', 'billing_period_display',
            'base_cost', 'discount_rate', 'discount_percentage', 'actual_cost',
            'running_hours', 'cpu_usage_hours', 'memory_usage_hours', 'storage_usage_hours',
            'is_paid', 'paid_date', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_billing_period_display(self, obj):
        """格式化计费周期显示"""
        return obj.billing_period.strftime('%Y年%m月')

    def get_discount_percentage(self, obj):
        """获取折扣百分比"""
        return int((1 - obj.discount_rate) * 100)


class InformationSystemSummarySerializer(serializers.Serializer):
    """信息系统汇总序列化器"""

    total_systems = serializers.IntegerField()
    running_systems = serializers.IntegerField()
    stopped_systems = serializers.IntegerField()
    maintenance_systems = serializers.IntegerField()
    total_cpu = serializers.IntegerField()
    total_memory = serializers.IntegerField()
    total_storage = serializers.IntegerField()


class SystemResourceSummarySerializer(serializers.Serializer):
    """系统资源汇总序列化器"""

    total_resources = serializers.IntegerField()
    active_resources = serializers.IntegerField()
    inactive_resources = serializers.IntegerField()
    error_resources = serializers.IntegerField()
    total_cpu = serializers.IntegerField()
    total_memory = serializers.IntegerField()
    total_storage = serializers.IntegerField()