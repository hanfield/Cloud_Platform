"""
合同管理视图
"""

import logging
from django.db.models import Q, Count, Sum
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import Contract, ContractItem, ContractPayment, ContractRenewal
from .serializers import (
    ContractSerializer, ContractCreateSerializer, ContractUpdateSerializer,
    ContractListSerializer, ContractStatisticsSerializer,
    ContractItemSerializer, ContractPaymentSerializer, ContractRenewalSerializer
)

logger = logging.getLogger(__name__)


class ContractViewSet(viewsets.ModelViewSet):
    """合同管理视图集"""

    queryset = Contract.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['contract_number', 'title', 'tenant__name', 'client_contact_person']
    ordering_fields = ['contract_number', 'title', 'created_at', 'start_date', 'end_date', 'total_amount']
    ordering = ['-created_at']

    filterset_fields = {
        'contract_type': ['exact'],
        'status': ['exact'],
        'tenant': ['exact'],
        'billing_method': ['exact'],
        'created_at': ['gte', 'lte'],
        'start_date': ['gte', 'lte'],
        'end_date': ['gte', 'lte'],
        'total_amount': ['gte', 'lte'],
    }

    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'create':
            return ContractCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ContractUpdateSerializer
        elif self.action == 'list':
            return ContractListSerializer
        return ContractSerializer

    def perform_create(self, serializer):
        """创建合同时记录创建者"""
        contract = serializer.save(created_by=self.request.user)
        logger.info(f"用户 {self.request.user.username} 创建了合同 {contract.contract_number}")

    def perform_update(self, serializer):
        """更新合同"""
        contract = serializer.save()
        logger.info(f"用户 {self.request.user.username} 更新了合同 {contract.contract_number}")

    def perform_destroy(self, instance):
        """删除合同"""
        logger.info(f"用户 {self.request.user.username} 删除了合同 {instance.contract_number}")
        super().perform_destroy(instance)

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        """审批合同"""
        contract = self.get_object()

        if contract.status != Contract.Status.PENDING:
            return Response(
                {'error': '只能审批待审核状态的合同'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contract.status = Contract.Status.ACTIVE
        contract.approved_by = request.user
        contract.approved_at = timezone.now()
        if not contract.signed_date:
            contract.signed_date = timezone.now().date()
        contract.save()

        logger.info(f"用户 {request.user.username} 审批了合同 {contract.contract_number}")
        return Response({'detail': '合同审批成功'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        """拒绝合同"""
        contract = self.get_object()

        if contract.status != Contract.Status.PENDING:
            return Response(
                {'error': '只能拒绝待审核状态的合同'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contract.status = Contract.Status.DRAFT
        contract.save()

        logger.info(f"用户 {request.user.username} 拒绝了合同 {contract.contract_number}")
        return Response({'detail': '合同已拒绝'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """暂停合同"""
        contract = self.get_object()

        if contract.status != Contract.Status.ACTIVE:
            return Response(
                {'error': '只能暂停生效中的合同'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contract.status = Contract.Status.SUSPENDED
        contract.save()

        logger.info(f"用户 {request.user.username} 暂停了合同 {contract.contract_number}")
        return Response({'detail': '合同已暂停'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活合同"""
        contract = self.get_object()

        if contract.status != Contract.Status.SUSPENDED:
            return Response(
                {'error': '只能激活暂停状态的合同'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contract.status = Contract.Status.ACTIVE
        contract.save()

        logger.info(f"用户 {request.user.username} 激活了合同 {contract.contract_number}")
        return Response({'detail': '合同已激活'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """终止合同"""
        contract = self.get_object()

        if contract.status in [Contract.Status.TERMINATED, Contract.Status.EXPIRED]:
            return Response(
                {'error': '合同已经终止或过期'},
                status=status.HTTP_400_BAD_REQUEST
            )

        contract.status = Contract.Status.TERMINATED
        contract.save()

        logger.info(f"用户 {request.user.username} 终止了合同 {contract.contract_number}")
        return Response({'detail': '合同已终止'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取合同统计信息"""
        queryset = self.get_queryset()

        # 基本统计
        total_count = queryset.count()
        draft_count = queryset.filter(status=Contract.Status.DRAFT).count()
        pending_count = queryset.filter(status=Contract.Status.PENDING).count()
        active_count = queryset.filter(status=Contract.Status.ACTIVE).count()
        suspended_count = queryset.filter(status=Contract.Status.SUSPENDED).count()
        terminated_count = queryset.filter(status=Contract.Status.TERMINATED).count()
        expired_count = queryset.filter(status=Contract.Status.EXPIRED).count()

        # 金额统计
        amount_stats = queryset.aggregate(
            total_contract_amount=Sum('total_amount'),
            total_paid_amount=Sum('paid_amount')
        )

        total_contract_amount = amount_stats['total_contract_amount'] or 0
        total_paid_amount = amount_stats['total_paid_amount'] or 0
        total_remaining_amount = total_contract_amount - total_paid_amount

        # 类型统计
        standard_count = queryset.filter(contract_type=Contract.ContractType.STANDARD).count()
        custom_count = queryset.filter(contract_type=Contract.ContractType.CUSTOM).count()
        trial_count = queryset.filter(contract_type=Contract.ContractType.TRIAL).count()
        upgrade_count = queryset.filter(contract_type=Contract.ContractType.UPGRADE).count()

        stats_data = {
            'total_count': total_count,
            'draft_count': draft_count,
            'pending_count': pending_count,
            'active_count': active_count,
            'suspended_count': suspended_count,
            'terminated_count': terminated_count,
            'expired_count': expired_count,
            'total_contract_amount': total_contract_amount,
            'total_paid_amount': total_paid_amount,
            'total_remaining_amount': total_remaining_amount,
            'standard_count': standard_count,
            'custom_count': custom_count,
            'trial_count': trial_count,
            'upgrade_count': upgrade_count,
        }

        serializer = ContractStatisticsSerializer(data=stats_data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def expiring_soon(self, request):
        """获取即将过期的合同"""
        days = int(request.query_params.get('days', 30))  # 默认30天

        expiring_date = timezone.now().date() + timezone.timedelta(days=days)

        expiring_contracts = self.get_queryset().filter(
            status=Contract.Status.ACTIVE,
            end_date__lte=expiring_date,
            end_date__gte=timezone.now().date()
        ).order_by('end_date')

        page = self.paginate_queryset(expiring_contracts)
        if page is not None:
            serializer = ContractListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ContractListSerializer(expiring_contracts, many=True)
        return Response(serializer.data)


class ContractItemViewSet(viewsets.ModelViewSet):
    """合同项目视图集"""

    queryset = ContractItem.objects.all()
    serializer_class = ContractItemSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['id', 'item_type', 'name', 'quantity', 'unit_price', 'subtotal']
    ordering = ['id']

    filterset_fields = {
        'contract': ['exact'],
        'item_type': ['exact'],
    }


class ContractPaymentViewSet(viewsets.ModelViewSet):
    """合同付款记录视图集"""

    queryset = ContractPayment.objects.all()
    serializer_class = ContractPaymentSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['payment_date', 'amount', 'created_at']
    ordering = ['-payment_date']

    filterset_fields = {
        'contract': ['exact'],
        'payment_method': ['exact'],
        'status': ['exact'],
        'payment_date': ['gte', 'lte'],
        'amount': ['gte', 'lte'],
    }

    def perform_create(self, serializer):
        """创建付款记录时记录记录人"""
        payment = serializer.save(recorded_by=self.request.user)

        # 更新合同已付金额
        if payment.status == ContractPayment.PaymentStatus.CONFIRMED:
            contract = payment.contract
            contract.paid_amount += payment.amount
            contract.save()

        logger.info(f"用户 {self.request.user.username} 记录了付款 {payment.amount}")

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        """确认付款"""
        payment = self.get_object()

        if payment.status != ContractPayment.PaymentStatus.PENDING:
            return Response(
                {'error': '只能确认待处理状态的付款'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.status = ContractPayment.PaymentStatus.CONFIRMED
        payment.confirmed_by = request.user
        payment.confirmed_at = timezone.now()
        payment.save()

        # 更新合同已付金额
        contract = payment.contract
        contract.paid_amount += payment.amount
        contract.save()

        logger.info(f"用户 {request.user.username} 确认了付款 {payment.amount}")
        return Response({'detail': '付款已确认'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject_payment(self, request, pk=None):
        """拒绝付款"""
        payment = self.get_object()

        if payment.status != ContractPayment.PaymentStatus.PENDING:
            return Response(
                {'error': '只能拒绝待处理状态的付款'},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment.status = ContractPayment.PaymentStatus.REJECTED
        payment.save()

        logger.info(f"用户 {request.user.username} 拒绝了付款 {payment.amount}")
        return Response({'detail': '付款已拒绝'}, status=status.HTTP_200_OK)


class ContractRenewalViewSet(viewsets.ModelViewSet):
    """合同续约视图集"""

    queryset = ContractRenewal.objects.all()
    serializer_class = ContractRenewalSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['created_at', 'renewal_period_months', 'new_total_amount']
    ordering = ['-created_at']

    filterset_fields = {
        'original_contract': ['exact'],
        'status': ['exact'],
        'created_at': ['gte', 'lte'],
    }

    def perform_create(self, serializer):
        """创建续约申请时记录申请人"""
        renewal = serializer.save(requested_by=self.request.user)
        logger.info(f"用户 {self.request.user.username} 申请续约合同 {renewal.original_contract.contract_number}")

    @action(detail=True, methods=['post'])
    def approve_renewal(self, request, pk=None):
        """审批续约申请"""
        renewal = self.get_object()

        if renewal.status != ContractRenewal.RenewalStatus.PENDING:
            return Response(
                {'error': '只能审批待处理状态的续约申请'},
                status=status.HTTP_400_BAD_REQUEST
            )

        renewal.status = ContractRenewal.RenewalStatus.APPROVED
        renewal.approved_by = request.user
        renewal.approved_at = timezone.now()
        renewal.save()

        logger.info(f"用户 {request.user.username} 审批了续约申请 {renewal.id}")
        return Response({'detail': '续约申请已审批'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def reject_renewal(self, request, pk=None):
        """拒绝续约申请"""
        renewal = self.get_object()

        if renewal.status != ContractRenewal.RenewalStatus.PENDING:
            return Response(
                {'error': '只能拒绝待处理状态的续约申请'},
                status=status.HTTP_400_BAD_REQUEST
            )

        renewal.status = ContractRenewal.RenewalStatus.REJECTED
        renewal.save()

        logger.info(f"用户 {request.user.username} 拒绝了续约申请 {renewal.id}")
        return Response({'detail': '续约申请已拒绝'}, status=status.HTTP_200_OK)