"""
租户管理序列化器
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Tenant, TenantResourceUsage, TenantOperationLog, Stakeholder, DataCenter


class TenantSerializer(serializers.ModelSerializer):
    """租户序列化器"""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    discount_rate = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'code', 'description',
            'level', 'discount_level', 'tenant_type', 'status',
            'contact_person', 'contact_phone', 'contact_email', 'address',
            'start_time', 'end_time', 'created_at', 'updated_at',
            'created_by', 'created_by_name',
            'openstack_project_id',
            'quota_vcpus', 'quota_memory', 'quota_disk',
            'quota_instances', 'quota_networks', 'quota_floating_ips',
            'discount_rate', 'is_active'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'created_by', 'openstack_project_id']

    def validate_name(self, value):
        """验证租户名称"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("租户名称至少需要2个字符")
        return value.strip()

    def validate_code(self, value):
        """验证租户编码"""
        if not value.isalnum():
            raise serializers.ValidationError("租户编码只能包含字母和数字")
        return value.upper()

    def validate(self, data):
        """验证数据"""
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("结束时间必须晚于开始时间")
        return data


class TenantCreateSerializer(serializers.ModelSerializer):
    """租户创建序列化器"""

    class Meta:
        model = Tenant
        fields = [
            'name', 'code', 'description',
            'level', 'discount_level', 'tenant_type',
            'contact_person', 'contact_phone', 'contact_email', 'address',
            'start_time', 'end_time',
            'quota_vcpus', 'quota_memory', 'quota_disk',
            'quota_instances', 'quota_networks', 'quota_floating_ips'
        ]

    def validate_name(self, value):
        """验证租户名称"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("租户名称至少需要2个字符")
        return value.strip()

    def validate_code(self, value):
        """验证租户编码"""
        if not value.isalnum():
            raise serializers.ValidationError("租户编码只能包含字母和数字")
        return value.upper()

    def validate(self, data):
        """验证数据"""
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("结束时间必须晚于开始时间")
        return data


class TenantUpdateSerializer(serializers.ModelSerializer):
    """租户更新序列化器"""

    class Meta:
        model = Tenant
        fields = [
            'name', 'description',
            'level', 'discount_level', 'tenant_type', 'status',
            'contact_person', 'contact_phone', 'contact_email', 'address',
            'start_time', 'end_time',
            'quota_vcpus', 'quota_memory', 'quota_disk',
            'quota_instances', 'quota_networks', 'quota_floating_ips'
        ]

    def validate_name(self, value):
        """验证租户名称"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("租户名称至少需要2个字符")
        return value.strip()

    def validate(self, data):
        """验证数据"""
        if data.get('start_time') and data.get('end_time'):
            if data['start_time'] >= data['end_time']:
                raise serializers.ValidationError("结束时间必须晚于开始时间")
        return data


class TenantResourceUsageSerializer(serializers.ModelSerializer):
    """租户资源使用情况序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)

    class Meta:
        model = TenantResourceUsage
        fields = [
            'id', 'tenant', 'tenant_name',
            'used_vcpus', 'used_memory', 'used_disk',
            'used_instances', 'used_networks', 'used_floating_ips',
            'monthly_cost', 'record_date'
        ]
        read_only_fields = ['id', 'record_date']


class TenantOperationLogSerializer(serializers.ModelSerializer):
    """租户操作日志序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    operator_name = serializers.CharField(source='operator.username', read_only=True)

    class Meta:
        model = TenantOperationLog
        fields = [
            'id', 'tenant', 'tenant_name',
            'operation_type', 'operation_detail',
            'operator', 'operator_name',
            'operation_time'
        ]
        read_only_fields = ['id', 'operation_time']


class TenantStatisticsSerializer(serializers.Serializer):
    """租户统计信息序列化器"""

    total_count = serializers.IntegerField()
    active_count = serializers.IntegerField()
    suspended_count = serializers.IntegerField()
    terminated_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()

    # 按级别统计
    superior_count = serializers.IntegerField()
    important_count = serializers.IntegerField()
    ordinary_count = serializers.IntegerField()

    # 按类型统计
    virtual_count = serializers.IntegerField()
    virtual_physical_count = serializers.IntegerField()
    virtual_physical_network_count = serializers.IntegerField()
    datacenter_cabinet_count = serializers.IntegerField()

    # 资源统计
    total_vcpus = serializers.IntegerField()
    total_memory = serializers.IntegerField()
    total_disk = serializers.IntegerField()
    total_instances = serializers.IntegerField()


class TenantListSerializer(serializers.ModelSerializer):
    """租户列表序列化器（简化版）"""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    is_active = serializers.ReadOnlyField()

    class Meta:
        model = Tenant
        fields = [
            'id', 'name', 'code',
            'level', 'discount_level', 'tenant_type', 'status',
            'contact_person', 'contact_phone', 'contact_email',
            'start_time', 'end_time', 'created_at',
            'created_by_name', 'is_active'
        ]


class StakeholderSerializer(serializers.ModelSerializer):
    """干系人序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    stakeholder_type_display = serializers.CharField(source='get_stakeholder_type_display', read_only=True)

    # 加密字段的只读属性
    phone = serializers.ReadOnlyField()
    email = serializers.ReadOnlyField()

    class Meta:
        model = Stakeholder
        fields = [
            'id', 'tenant', 'tenant_name',
            'stakeholder_type', 'stakeholder_type_display',
            'name', 'phone', 'email',
            'position', 'department', 'is_primary', 'notes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """验证姓名"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("姓名至少需要2个字符")
        return value.strip()

    def validate_phone(self, value):
        """验证电话号码"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("电话号码格式不正确")
        return value

    def validate_email(self, value):
        """验证邮箱"""
        if value and '@' not in value:
            raise serializers.ValidationError("邮箱格式不正确")
        return value


class StakeholderCreateSerializer(serializers.ModelSerializer):
    """干系人创建序列化器"""

    class Meta:
        model = Stakeholder
        fields = [
            'tenant', 'stakeholder_type', 'name', 'phone', 'email',
            'position', 'department', 'is_primary', 'notes'
        ]

    def validate_name(self, value):
        """验证姓名"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("姓名至少需要2个字符")
        return value.strip()

    def validate_phone(self, value):
        """验证电话号码"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("电话号码格式不正确")
        return value

    def validate_email(self, value):
        """验证邮箱"""
        if value and '@' not in value:
            raise serializers.ValidationError("邮箱格式不正确")
        return value


class StakeholderUpdateSerializer(serializers.ModelSerializer):
    """干系人更新序列化器"""

    class Meta:
        model = Stakeholder
        fields = [
            'stakeholder_type', 'name', 'phone', 'email',
            'position', 'department', 'is_primary', 'notes'
        ]

    def validate_name(self, value):
        """验证姓名"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("姓名至少需要2个字符")
        return value.strip()

    def validate_phone(self, value):
        """验证电话号码"""
        if value and not value.replace('+', '').replace('-', '').replace(' ', '').isdigit():
            raise serializers.ValidationError("电话号码格式不正确")
        return value

    def validate_email(self, value):
        """验证邮箱"""
        if value and '@' not in value:
            raise serializers.ValidationError("邮箱格式不正确")
        return value


class DataCenterSerializer(serializers.ModelSerializer):
    """数据中心序列化器"""

    data_center_type_display = serializers.CharField(source='get_data_center_type_display', read_only=True)

    class Meta:
        model = DataCenter
        fields = [
            'id', 'name', 'code',
            'data_center_type', 'data_center_type_display',
            'location', 'description', 'is_active',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_name(self, value):
        """验证数据中心名称"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("数据中心名称至少需要2个字符")
        return value.strip()

    def validate_code(self, value):
        """验证数据中心代码"""
        if not value.isalnum():
            raise serializers.ValidationError("数据中心代码只能包含字母和数字")
        return value.upper()


class DataCenterCreateSerializer(serializers.ModelSerializer):
    """数据中心创建序列化器"""

    class Meta:
        model = DataCenter
        fields = [
            'name', 'code', 'data_center_type',
            'location', 'description', 'is_active'
        ]

    def validate_name(self, value):
        """验证数据中心名称"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("数据中心名称至少需要2个字符")
        return value.strip()

    def validate_code(self, value):
        """验证数据中心代码"""
        if not value.isalnum():
            raise serializers.ValidationError("数据中心代码只能包含字母和数字")
        return value.upper()


class DataCenterUpdateSerializer(serializers.ModelSerializer):
    """数据中心更新序列化器"""

    class Meta:
        model = DataCenter
        fields = [
            'name', 'data_center_type',
            'location', 'description', 'is_active'
        ]

    def validate_name(self, value):
        """验证数据中心名称"""
        if len(value.strip()) < 2:
            raise serializers.ValidationError("数据中心名称至少需要2个字符")
        return value.strip()