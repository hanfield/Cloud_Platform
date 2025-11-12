"""
合同管理序列化器
"""

from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Contract, ContractItem, ContractPayment, ContractRenewal


class ContractItemSerializer(serializers.ModelSerializer):
    """合同项目序列化器"""

    class Meta:
        model = ContractItem
        fields = [
            'id', 'item_type', 'name', 'description',
            'quantity', 'unit', 'unit_price', 'subtotal', 'remarks'
        ]
        read_only_fields = ['id', 'subtotal']

    def validate_quantity(self, value):
        """验证数量"""
        if value <= 0:
            raise serializers.ValidationError("数量必须大于0")
        return value

    def validate_unit_price(self, value):
        """验证单价"""
        if value < 0:
            raise serializers.ValidationError("单价不能为负数")
        return value


class ContractPaymentSerializer(serializers.ModelSerializer):
    """合同付款记录序列化器"""

    recorded_by_name = serializers.CharField(source='recorded_by.username', read_only=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.username', read_only=True)

    class Meta:
        model = ContractPayment
        fields = [
            'id', 'amount', 'payment_date', 'payment_method', 'status',
            'reference_number', 'notes', 'receipt_file',
            'recorded_by', 'recorded_by_name',
            'confirmed_by', 'confirmed_by_name', 'confirmed_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'confirmed_at']

    def validate_amount(self, value):
        """验证付款金额"""
        if value <= 0:
            raise serializers.ValidationError("付款金额必须大于0")
        return value


class ContractRenewalSerializer(serializers.ModelSerializer):
    """合同续约序列化器"""

    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)
    original_contract_number = serializers.CharField(source='original_contract.contract_number', read_only=True)
    new_contract_number = serializers.CharField(source='new_contract.contract_number', read_only=True)

    class Meta:
        model = ContractRenewal
        fields = [
            'id', 'original_contract', 'original_contract_number',
            'new_contract', 'new_contract_number',
            'renewal_period_months', 'new_total_amount', 'status', 'renewal_reason',
            'requested_by', 'requested_by_name',
            'approved_by', 'approved_by_name', 'approved_at',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'approved_at']

    def validate_renewal_period_months(self, value):
        """验证续约期限"""
        if value < 1:
            raise serializers.ValidationError("续约期限至少为1个月")
        return value

    def validate_new_total_amount(self, value):
        """验证续约金额"""
        if value <= 0:
            raise serializers.ValidationError("续约金额必须大于0")
        return value


class ContractSerializer(serializers.ModelSerializer):
    """合同序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.username', read_only=True)

    # 计算字段
    remaining_amount = serializers.ReadOnlyField()
    payment_progress = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    days_remaining = serializers.ReadOnlyField()

    # 关联数据
    items = ContractItemSerializer(many=True, read_only=True)
    payments = ContractPaymentSerializer(many=True, read_only=True)
    renewals = ContractRenewalSerializer(many=True, read_only=True)

    class Meta:
        model = Contract
        fields = [
            'id', 'contract_number', 'title', 'description',
            'tenant', 'tenant_name',
            'contract_type', 'status',
            'start_date', 'end_date', 'signed_date',
            'billing_method', 'total_amount', 'paid_amount', 'discount_rate',
            'terms_and_conditions', 'special_terms',
            'client_contact_person', 'client_contact_phone', 'client_contact_email',
            'company_contact_person', 'company_contact_phone', 'company_contact_email',
            'contract_file',
            'created_by', 'created_by_name',
            'approved_by', 'approved_by_name', 'approved_at',
            'created_at', 'updated_at',
            'remaining_amount', 'payment_progress', 'is_expired', 'days_remaining',
            'items', 'payments', 'renewals'
        ]
        read_only_fields = [
            'id', 'created_at', 'updated_at', 'approved_at',
            'remaining_amount', 'payment_progress', 'is_expired', 'days_remaining'
        ]

    def validate_contract_number(self, value):
        """验证合同编号"""
        if len(value.strip()) < 3:
            raise serializers.ValidationError("合同编号至少需要3个字符")
        return value.strip().upper()

    def validate(self, data):
        """验证数据"""
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] >= data['end_date']:
                raise serializers.ValidationError("结束日期必须晚于开始日期")

        if data.get('total_amount') and data.get('paid_amount'):
            if data['paid_amount'] > data['total_amount']:
                raise serializers.ValidationError("已付金额不能超过合同总金额")

        if data.get('discount_rate'):
            if data['discount_rate'] < 0 or data['discount_rate'] > 2:
                raise serializers.ValidationError("折扣率必须在0-2之间")

        return data


class ContractCreateSerializer(serializers.ModelSerializer):
    """合同创建序列化器"""

    items_data = ContractItemSerializer(many=True, required=False)

    class Meta:
        model = Contract
        fields = [
            'contract_number', 'title', 'description',
            'tenant', 'contract_type',
            'start_date', 'end_date',
            'billing_method', 'total_amount', 'discount_rate',
            'terms_and_conditions', 'special_terms',
            'client_contact_person', 'client_contact_phone', 'client_contact_email',
            'company_contact_person', 'company_contact_phone', 'company_contact_email',
            'contract_file',
            'items_data'
        ]

    def create(self, validated_data):
        """创建合同和项目"""
        items_data = validated_data.pop('items_data', [])
        contract = Contract.objects.create(**validated_data)

        # 创建合同项目
        for item_data in items_data:
            ContractItem.objects.create(contract=contract, **item_data)

        return contract

    def validate_contract_number(self, value):
        """验证合同编号"""
        if len(value.strip()) < 3:
            raise serializers.ValidationError("合同编号至少需要3个字符")
        return value.strip().upper()

    def validate(self, data):
        """验证数据"""
        if data.get('start_date') and data.get('end_date'):
            if data['start_date'] >= data['end_date']:
                raise serializers.ValidationError("结束日期必须晚于开始日期")

        if data.get('discount_rate'):
            if data['discount_rate'] < 0 or data['discount_rate'] > 2:
                raise serializers.ValidationError("折扣率必须在0-2之间")

        return data


class ContractUpdateSerializer(serializers.ModelSerializer):
    """合同更新序列化器"""

    class Meta:
        model = Contract
        fields = [
            'title', 'description',
            'contract_type', 'status',
            'start_date', 'end_date', 'signed_date',
            'billing_method', 'total_amount', 'paid_amount', 'discount_rate',
            'terms_and_conditions', 'special_terms',
            'client_contact_person', 'client_contact_phone', 'client_contact_email',
            'company_contact_person', 'company_contact_phone', 'company_contact_email',
            'contract_file'
        ]

    def validate(self, data):
        """验证数据"""
        instance = self.instance

        start_date = data.get('start_date', instance.start_date)
        end_date = data.get('end_date', instance.end_date)
        if start_date and end_date and start_date >= end_date:
            raise serializers.ValidationError("结束日期必须晚于开始日期")

        total_amount = data.get('total_amount', instance.total_amount)
        paid_amount = data.get('paid_amount', instance.paid_amount)
        if total_amount and paid_amount and paid_amount > total_amount:
            raise serializers.ValidationError("已付金额不能超过合同总金额")

        discount_rate = data.get('discount_rate')
        if discount_rate and (discount_rate < 0 or discount_rate > 2):
            raise serializers.ValidationError("折扣率必须在0-2之间")

        return data


class ContractListSerializer(serializers.ModelSerializer):
    """合同列表序列化器（简化版）"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    remaining_amount = serializers.ReadOnlyField()
    payment_progress = serializers.ReadOnlyField()
    is_expired = serializers.ReadOnlyField()
    days_remaining = serializers.ReadOnlyField()

    class Meta:
        model = Contract
        fields = [
            'id', 'contract_number', 'title',
            'tenant', 'tenant_name',
            'contract_type', 'status',
            'start_date', 'end_date', 'signed_date',
            'total_amount', 'paid_amount',
            'created_by_name', 'created_at',
            'remaining_amount', 'payment_progress', 'is_expired', 'days_remaining'
        ]


class ContractStatisticsSerializer(serializers.Serializer):
    """合同统计信息序列化器"""

    total_count = serializers.IntegerField()
    draft_count = serializers.IntegerField()
    pending_count = serializers.IntegerField()
    active_count = serializers.IntegerField()
    suspended_count = serializers.IntegerField()
    terminated_count = serializers.IntegerField()
    expired_count = serializers.IntegerField()

    # 金额统计
    total_contract_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_remaining_amount = serializers.DecimalField(max_digits=15, decimal_places=2)

    # 类型统计
    standard_count = serializers.IntegerField()
    custom_count = serializers.IntegerField()
    trial_count = serializers.IntegerField()
    upgrade_count = serializers.IntegerField()