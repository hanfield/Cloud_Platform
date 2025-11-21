"""
账单和订单管理序列化器
"""

from rest_framework import serializers
from .models import MonthlyBill, BillItem, Payment
from datetime import date


class BillItemSerializer(serializers.ModelSerializer):
    """账单明细序列化器"""

    item_type_display = serializers.CharField(source='get_item_type_display', read_only=True)
    information_system_name = serializers.CharField(source='information_system.name', read_only=True, allow_null=True)

    class Meta:
        model = BillItem
        fields = [
            'id', 'bill', 'item_type', 'item_type_display', 'name', 'description',
            'information_system', 'information_system_name', 'billing_date',
            'quantity', 'unit', 'unit_price', 'amount', 'discount_rate',
            'discount_amount', 'final_amount', 'created_at'
        ]
        read_only_fields = ['id', 'amount', 'discount_amount', 'final_amount', 'created_at']


class MonthlyBillSerializer(serializers.ModelSerializer):
    """月度账单序列化器"""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_progress = serializers.FloatField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    items = BillItemSerializer(many=True, read_only=True)
    current_month_amount = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyBill
        fields = [
            'id', 'bill_number', 'tenant', 'tenant_name', 'billing_year', 'billing_month',
            'billing_period_start', 'billing_period_end', 'total_amount', 'paid_amount',
            'discount_amount', 'remaining_amount', 'payment_progress', 'status', 'status_display',
            'due_date', 'generated_at', 'paid_at', 'notes', 'created_at', 'updated_at',
            'is_overdue', 'items', 'current_month_amount'
        ]
        read_only_fields = ['id', 'bill_number', 'generated_at', 'created_at', 'updated_at']

    def get_current_month_amount(self, obj):
        """获取当月应收费用（截至查询日期前一日）"""
        # 从请求中获取查询日期，默认为今天
        request = self.context.get('request')
        if request and 'query_date' in request.query_params:
            query_date_str = request.query_params['query_date']
            try:
                query_date = date.fromisoformat(query_date_str)
            except ValueError:
                query_date = date.today()
        else:
            query_date = date.today()

        return str(obj.calculate_current_month_amount(query_date))


class MonthlyBillListSerializer(serializers.ModelSerializer):
    """月度账单列表序列化器（简化版）"""

    status_display = serializers.CharField(source='get_status_display', read_only=True)
    tenant_name = serializers.CharField(source='tenant.name', read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_progress = serializers.FloatField(read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)
    items_count = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyBill
        fields = [
            'id', 'bill_number', 'tenant', 'tenant_name', 'billing_year', 'billing_month',
            'billing_period_start', 'billing_period_end', 'total_amount', 'paid_amount',
            'remaining_amount', 'payment_progress', 'status', 'status_display',
            'due_date', 'is_overdue', 'items_count', 'created_at'
        ]

    def get_items_count(self, obj):
        """获取账单明细数量"""
        return obj.items.count()




class PaymentSerializer(serializers.ModelSerializer):
    """支付记录序列化器"""

    payment_method_display = serializers.CharField(source='get_payment_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    order_number = serializers.CharField(source='order.order_number', read_only=True, allow_null=True)
    bill_number = serializers.CharField(source='bill.bill_number', read_only=True, allow_null=True)
    confirmed_by_name = serializers.CharField(source='confirmed_by.username', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True, allow_null=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'payment_number', 'order', 'order_number', 'bill', 'bill_number',
            'amount', 'payment_method', 'payment_method_display', 'status', 'status_display',
            'payment_date', 'transaction_id', 'payer_account', 'receipt_file', 'notes',
            'confirmed_by', 'confirmed_by_name', 'confirmed_at',
            'created_by', 'created_by_name', 'created_at', 'updated_at'
        ]
        read_only_fields = ['id', 'payment_number', 'created_at', 'updated_at', 'confirmed_at']
