"""
产品管理序列化器
"""

from rest_framework import serializers
from .models import Product, DiscountLevel, ProductSubscription, PricingTier
from apps.tenants.models import Tenant
from apps.contracts.models import Contract


class ProductSerializer(serializers.ModelSerializer):
    """产品序列化器"""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    product_type_display = serializers.CharField(
        source='get_product_type_display', read_only=True
    )
    subcategory_display = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    pricing_model_display = serializers.CharField(
        source='get_pricing_model_display', read_only=True
    )
    billing_period_display = serializers.CharField(
        source='get_billing_period_display', read_only=True
    )
    billing_unit_display = serializers.CharField(
        source='get_billing_unit_display', read_only=True
    )
    formatted_price = serializers.CharField(read_only=True)
    subscription_count = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = [
            'id', 'name', 'code', 'description', 'product_type', 'product_type_display',
            'subcategory', 'subcategory_display', 'status', 'status_display',
            'base_price', 'billing_unit', 'billing_unit_display',
            'billing_period', 'billing_period_display', 'pricing_model', 'pricing_model_display',
            'min_quantity', 'cpu_capacity', 'memory_capacity', 'storage_capacity',
            'features', 'specifications', 'service_level',
            'created_at', 'updated_at', 'created_by', 'created_by_name',
            'formatted_price', 'subscription_count'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_subcategory_display(self, obj):
        """获取子类别显示值"""
        if not obj.subcategory:
            return ""

        # 根据产品类型映射子类别显示值
        subcategory_mapping = {
            'ecs': dict(Product.ECSSubcategory.choices),
            'ods': dict(Product.ODSSubcategory.choices),
            'net': dict(Product.NETSubcategory.choices),
            'anq': dict(Product.ANQSubcategory.choices),
            'bas': dict(Product.BASSubcategory.choices),
        }

        mapping = subcategory_mapping.get(obj.product_type, {})
        return mapping.get(obj.subcategory, obj.subcategory)

    def get_subscription_count(self, obj):
        """获取产品订阅数量"""
        return obj.subscriptions.filter(
            status=ProductSubscription.SubscriptionStatus.ACTIVE
        ).count()


class ProductCreateSerializer(serializers.ModelSerializer):
    """产品创建序列化器"""

    class Meta:
        model = Product
        fields = [
            'name', 'code', 'description', 'product_type', 'subcategory', 'status',
            'base_price', 'billing_unit', 'billing_period', 'pricing_model',
            'min_quantity', 'cpu_capacity', 'memory_capacity', 'storage_capacity',
            'features', 'specifications', 'service_level'
        ]

    def validate(self, attrs):
        """验证数据"""
        # 验证价格
        base_price = attrs.get('base_price', 0)
        if base_price < 0:
            raise serializers.ValidationError({"base_price": "基础价格不能为负数"})

        # 验证容量
        cpu_capacity = attrs.get('cpu_capacity', 0)
        memory_capacity = attrs.get('memory_capacity', 0)
        storage_capacity = attrs.get('storage_capacity', 0)

        if cpu_capacity < 0:
            raise serializers.ValidationError({"cpu_capacity": "CPU容量不能为负数"})
        if memory_capacity < 0:
            raise serializers.ValidationError({"memory_capacity": "内存容量不能为负数"})
        if storage_capacity < 0:
            raise serializers.ValidationError({"storage_capacity": "存储容量不能为负数"})

        return attrs


class DiscountLevelSerializer(serializers.ModelSerializer):
    """折扣级别序列化器"""

    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    customer_type_display = serializers.CharField(
        source='get_customer_type_display', read_only=True
    )
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    discount_percentage = serializers.IntegerField(read_only=True)

    class Meta:
        model = DiscountLevel
        fields = [
            'id', 'name', 'code', 'description', 'discount_rate', 'discount_percentage',
            'customer_type', 'customer_type_display', 'status', 'status_display',
            'min_amount', 'max_amount', 'created_at', 'updated_at',
            'created_by', 'created_by_name'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']


class DiscountLevelCreateSerializer(serializers.ModelSerializer):
    """折扣级别创建序列化器"""

    class Meta:
        model = DiscountLevel
        fields = [
            'name', 'code', 'description', 'discount_rate', 'customer_type', 'status',
            'min_amount', 'max_amount'
        ]

    def validate(self, attrs):
        """验证数据"""
        discount_rate = attrs.get('discount_rate', 1.0)
        min_amount = attrs.get('min_amount', 0)
        max_amount = attrs.get('max_amount', 0)

        if discount_rate < 0 or discount_rate > 1:
            raise serializers.ValidationError({
                "discount_rate": "折扣率必须在0到1之间"
            })

        if min_amount < 0:
            raise serializers.ValidationError({
                "min_amount": "最小消费金额不能为负数"
            })

        if max_amount < 0:
            raise serializers.ValidationError({
                "max_amount": "最大消费金额不能为负数"
            })

        if max_amount > 0 and min_amount > max_amount:
            raise serializers.ValidationError({
                "min_amount": "最小消费金额不能大于最大消费金额"
            })

        return attrs


class ProductSubscriptionSerializer(serializers.ModelSerializer):
    """产品订阅序列化器"""

    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    product_name = serializers.CharField(source='product.name', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.BooleanField(read_only=True)
    discount_percentage = serializers.SerializerMethodField()

    class Meta:
        model = ProductSubscription
        fields = [
            'id', 'tenant', 'tenant_name', 'product', 'product_name',
            'contract', 'contract_number', 'quantity', 'status', 'status_display',
            'unit_price', 'discount_rate', 'discount_percentage', 'monthly_cost',
            'start_date', 'end_date', 'created_at', 'updated_at',
            'created_by', 'created_by_name', 'is_active'
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def get_discount_percentage(self, obj):
        """获取折扣百分比"""
        return int((1 - obj.discount_rate) * 100)


class ProductSubscriptionCreateSerializer(serializers.ModelSerializer):
    """产品订阅创建序列化器"""

    class Meta:
        model = ProductSubscription
        fields = [
            'tenant', 'product', 'contract', 'quantity', 'status',
            'unit_price', 'discount_rate', 'start_date', 'end_date'
        ]

    def validate(self, attrs):
        """验证数据"""
        tenant = attrs.get('tenant')
        product = attrs.get('product')
        contract = attrs.get('contract')
        quantity = attrs.get('quantity', 1)
        unit_price = attrs.get('unit_price', 0)
        discount_rate = attrs.get('discount_rate', 1.0)
        start_date = attrs.get('start_date')
        end_date = attrs.get('end_date')

        # 验证租户存在
        if tenant and not Tenant.objects.filter(id=tenant.id).exists():
            raise serializers.ValidationError({"tenant": "租户不存在"})

        # 验证产品存在
        if product and not Product.objects.filter(id=product.id).exists():
            raise serializers.ValidationError({"product": "产品不存在"})

        # 验证合同存在
        if contract and not Contract.objects.filter(id=contract.id).exists():
            raise serializers.ValidationError({"contract": "合同不存在"})

        # 验证数量
        if quantity < 1:
            raise serializers.ValidationError({"quantity": "订阅数量必须大于0"})

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


class PricingTierSerializer(serializers.ModelSerializer):
    """定价阶梯序列化器"""

    product_name = serializers.CharField(source='product.name', read_only=True)

    class Meta:
        model = PricingTier
        fields = [
            'id', 'product', 'product_name', 'min_quantity', 'max_quantity',
            'unit_price', 'order'
        ]


class PricingTierCreateSerializer(serializers.ModelSerializer):
    """定价阶梯创建序列化器"""

    class Meta:
        model = PricingTier
        fields = [
            'product', 'min_quantity', 'max_quantity', 'unit_price', 'order'
        ]

    def validate(self, attrs):
        """验证数据"""
        min_quantity = attrs.get('min_quantity', 0)
        max_quantity = attrs.get('max_quantity')
        unit_price = attrs.get('unit_price', 0)

        if min_quantity < 0:
            raise serializers.ValidationError({
                "min_quantity": "最小数量不能为负数"
            })

        if max_quantity is not None and max_quantity < 0:
            raise serializers.ValidationError({
                "max_quantity": "最大数量不能为负数"
            })

        if max_quantity is not None and min_quantity > max_quantity:
            raise serializers.ValidationError({
                "min_quantity": "最小数量不能大于最大数量"
            })

        if unit_price < 0:
            raise serializers.ValidationError({
                "unit_price": "单价不能为负数"
            })

        return attrs


class ProductStatisticsSerializer(serializers.Serializer):
    """产品统计序列化器"""

    total_products = serializers.IntegerField()
    active_products = serializers.IntegerField()
    inactive_products = serializers.IntegerField()
    draft_products = serializers.IntegerField()
    product_types = serializers.DictField()
    pricing_models = serializers.DictField()


class SubscriptionStatisticsSerializer(serializers.Serializer):
    """订阅统计序列化器"""

    total_subscriptions = serializers.IntegerField()
    active_subscriptions = serializers.IntegerField()
    suspended_subscriptions = serializers.IntegerField()
    terminated_subscriptions = serializers.IntegerField()
    subscription_by_product = serializers.DictField()
    subscription_by_tenant = serializers.DictField()