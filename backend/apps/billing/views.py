"""
账单和订单管理视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum
from django.utils import timezone
from datetime import date, timedelta
from decimal import Decimal

from .models import MonthlyBill, BillItem, Payment
from .serializers import (
    MonthlyBillSerializer, MonthlyBillListSerializer, BillItemSerializer,
    PaymentSerializer
)


class MonthlyBillViewSet(viewsets.ModelViewSet):
    """月度账单视图集"""

    permission_classes = [IsAuthenticated]
    queryset = MonthlyBill.objects.all()

    def get_serializer_class(self):
        if self.action == 'list':
            return MonthlyBillListSerializer
        return MonthlyBillSerializer

    def get_queryset(self):
        queryset = MonthlyBill.objects.all()

        # 根据用户角色过滤
        user = self.request.user
        if not user.is_staff:
            # 非管理员只能看到自己租户的账单
            if hasattr(user, 'tenant'):
                queryset = queryset.filter(tenant=user.tenant)
            else:
                queryset = queryset.none()

        # 过滤参数
        tenant_id = self.request.query_params.get('tenant')
        year = self.request.query_params.get('year')
        month = self.request.query_params.get('month')
        status_param = self.request.query_params.get('status')

        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)
        if year:
            queryset = queryset.filter(billing_year=year)
        if month:
            queryset = queryset.filter(billing_month=month)
        if status_param:
            queryset = queryset.filter(status=status_param)

        return queryset.order_by('-billing_year', '-billing_month')

    @action(detail=True, methods=['get'])
    def items(self, request, pk=None):
        """获取账单明细"""
        bill = self.get_object()
        items = bill.items.all()
        serializer = BillItemSerializer(items, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def add_payment(self, request, pk=None):
        """添加支付记录"""
        bill = self.get_object()

        amount = Decimal(request.data.get('amount', 0))
        payment_method = request.data.get('payment_method', 'bank_transfer')
        notes = request.data.get('notes', '')

        if amount <= 0:
            return Response(
                {'error': '支付金额必须大于0'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if amount > bill.remaining_amount:
            return Response(
                {'error': '支付金额不能超过剩余应付金额'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 创建支付记录
        payment = Payment.objects.create(
            bill=bill,
            amount=amount,
            payment_method=payment_method,
            notes=notes,
            created_by=request.user,
            status='pending'
        )

        # 更新账单支付金额
        bill.paid_amount += amount
        if bill.paid_amount >= bill.total_amount:
            bill.status = 'paid'
            bill.paid_at = timezone.now()
        elif bill.paid_amount > 0:
            bill.status = 'partial_paid'
        bill.save()

        return Response(
            PaymentSerializer(payment).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def pay(self, request, pk=None):
        """全额支付账单"""
        bill = self.get_object()

        if bill.status == 'paid':
            return Response(
                {'error': '账单已支付'},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount = bill.remaining_amount
        if amount <= 0:
             return Response(
                {'error': '无需支付'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 创建支付记录
        payment = Payment.objects.create(
            bill=bill,
            amount=amount,
            payment_method='online', # Default to online for one-click pay
            notes='One-click payment',
            created_by=request.user,
            status='confirmed' # Auto-confirm for this simulation
        )

        # 更新账单
        bill.paid_amount += amount
        bill.status = 'paid'
        bill.paid_at = timezone.now()
        bill.save()

        return Response(
            {'status': 'success', 'message': '支付成功'},
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取账单统计信息"""
        queryset = self.get_queryset()

        # 按年份和月份统计
        year = request.query_params.get('year', date.today().year)
        month_stats = queryset.filter(billing_year=year).values(
            'billing_month'
        ).annotate(
            total=Sum('total_amount'),
            paid=Sum('paid_amount')
        ).order_by('billing_month')

        # 按状态统计
        status_stats = queryset.values('status').annotate(
            count=Sum('id'),
            total=Sum('total_amount')
        )

        # 总统计
        total_stats = queryset.aggregate(
            total_amount=Sum('total_amount'),
            paid_amount=Sum('paid_amount')
        )

        return Response({
            'month_stats': list(month_stats),
            'status_stats': list(status_stats),
            'total_stats': total_stats
        })


class BillItemViewSet(viewsets.ModelViewSet):
    """账单明细视图集"""

    permission_classes = [IsAuthenticated]
    queryset = BillItem.objects.all()
    serializer_class = BillItemSerializer

    def get_queryset(self):
        queryset = BillItem.objects.all()

        # 根据用户角色过滤
        user = self.request.user
        if not user.is_staff:
            if hasattr(user, 'tenant'):
                queryset = queryset.filter(bill__tenant=user.tenant)
            else:
                queryset = queryset.none()

        # 过滤参数
        bill_id = self.request.query_params.get('bill')
        item_type = self.request.query_params.get('item_type')

        if bill_id:
            queryset = queryset.filter(bill_id=bill_id)
        if item_type:
            queryset = queryset.filter(item_type=item_type)

        return queryset.order_by('-billing_date')




class PaymentViewSet(viewsets.ModelViewSet):
    """支付记录视图集"""

    permission_classes = [IsAuthenticated]
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer

    def get_queryset(self):
        queryset = Payment.objects.all()

        # 根据用户角色过滤
        user = self.request.user
        if not user.is_staff:
            if hasattr(user, 'tenant'):
                queryset = queryset.filter(
                    Q(order__tenant=user.tenant) | Q(bill__tenant=user.tenant)
                )
            else:
                queryset = queryset.none()

        # 过滤参数
        order_id = self.request.query_params.get('order')
        bill_id = self.request.query_params.get('bill')
        status_param = self.request.query_params.get('status')
        payment_method = self.request.query_params.get('payment_method')

        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if bill_id:
            queryset = queryset.filter(bill_id=bill_id)
        if status_param:
            queryset = queryset.filter(status=status_param)
        if payment_method:
            queryset = queryset.filter(payment_method=payment_method)

        return queryset.order_by('-payment_date')

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """确认支付"""
        payment = self.get_object()

        if payment.status != 'pending':
            return Response(
                {'error': '只有待确认状态的支付记录才能确认'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.status = 'confirmed'
        payment.confirmed_by = request.user
        payment.confirmed_at = timezone.now()
        payment.save()

        return Response(PaymentSerializer(payment).data)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝支付"""
        payment = self.get_object()

        if payment.status != 'pending':
            return Response(
                {'error': '只有待确认状态的支付记录才能拒绝'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 退还支付金额
        if payment.order:
            payment.order.paid_amount -= payment.amount
            if payment.order.paid_amount == 0:
                payment.order.payment_status = 'unpaid'
            elif payment.order.paid_amount < payment.order.total_amount:
                payment.order.payment_status = 'partial_paid'
            payment.order.save()

        if payment.bill:
            payment.bill.paid_amount -= payment.amount
            if payment.bill.paid_amount == 0:
                payment.bill.status = 'pending'
            elif payment.bill.paid_amount < payment.bill.total_amount:
                payment.bill.status = 'partial_paid'
            payment.bill.save()

        payment.status = 'failed'
        payment.confirmed_by = request.user
        payment.confirmed_at = timezone.now()
        payment.save()

        return Response(PaymentSerializer(payment).data)
