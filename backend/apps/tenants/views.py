"""
租户管理视图
"""

import logging
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import filters

from .models import Tenant, TenantResourceUsage, TenantOperationLog
from .serializers import (
    TenantSerializer, TenantCreateSerializer, TenantUpdateSerializer,
    TenantResourceUsageSerializer, TenantOperationLogSerializer,
    TenantStatisticsSerializer, TenantListSerializer
)

logger = logging.getLogger(__name__)


class TenantViewSet(viewsets.ModelViewSet):
    """租户管理视图集"""

    queryset = Tenant.objects.all()
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'code', 'contact_person', 'contact_email']
    ordering_fields = ['name', 'created_at', 'start_time', 'end_time']
    ordering = ['-created_at']

    filterset_fields = {
        'level': ['exact'],
        'discount_level': ['exact'],
        'tenant_type': ['exact'],
        'status': ['exact'],
        'created_at': ['gte', 'lte'],
        'start_time': ['gte', 'lte'],
        'end_time': ['gte', 'lte'],
    }

    def get_serializer_class(self):
        """根据动作选择序列化器"""
        if self.action == 'create':
            return TenantCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return TenantUpdateSerializer
        elif self.action == 'list':
            return TenantListSerializer
        return TenantSerializer

    def perform_create(self, serializer):
        """创建租户时记录创建者"""
        tenant = serializer.save(created_by=self.request.user, status=Tenant.Status.PENDING)

        # 记录操作日志
        TenantOperationLog.objects.create(
            tenant=tenant,
            operation_type=TenantOperationLog.OperationType.CREATE,
            operation_detail=f"创建租户: {tenant.name}",
            operator=self.request.user
        )

        logger.info(f"用户 {self.request.user.username} 创建了租户 {tenant.name}")

    def perform_update(self, serializer):
        """更新租户时记录操作日志"""
        old_instance = self.get_object()
        tenant = serializer.save()

        # 记录操作日志
        TenantOperationLog.objects.create(
            tenant=tenant,
            operation_type=TenantOperationLog.OperationType.UPDATE,
            operation_detail=f"更新租户信息: {tenant.name}",
            operator=self.request.user
        )

        logger.info(f"用户 {self.request.user.username} 更新了租户 {tenant.name}")

    def perform_destroy(self, instance):
        """删除租户时记录操作日志"""
        TenantOperationLog.objects.create(
            tenant=instance,
            operation_type=TenantOperationLog.OperationType.DELETE,
            operation_detail=f"删除租户: {instance.name}",
            operator=self.request.user
        )

        logger.info(f"用户 {self.request.user.username} 删除了租户 {instance.name}")
        super().perform_destroy(instance)

    @action(detail=True, methods=['post'])
    def activate(self, request, pk=None):
        """激活租户"""
        tenant = self.get_object()
        tenant.status = Tenant.Status.ACTIVE
        tenant.save()

        # 记录操作日志
        TenantOperationLog.objects.create(
            tenant=tenant,
            operation_type=TenantOperationLog.OperationType.ACTIVATE,
            operation_detail=f"激活租户: {tenant.name}",
            operator=request.user
        )

        logger.info(f"用户 {request.user.username} 激活了租户 {tenant.name}")
        return Response({'detail': '租户已激活'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def suspend(self, request, pk=None):
        """暂停租户"""
        tenant = self.get_object()
        tenant.status = Tenant.Status.SUSPENDED
        tenant.save()

        # 记录操作日志
        TenantOperationLog.objects.create(
            tenant=tenant,
            operation_type=TenantOperationLog.OperationType.SUSPEND,
            operation_detail=f"暂停租户: {tenant.name}",
            operator=request.user
        )

        logger.info(f"用户 {request.user.username} 暂停了租户 {tenant.name}")
        return Response({'detail': '租户已暂停'}, status=status.HTTP_200_OK)

    @action(detail=True, methods=['post'])
    def terminate(self, request, pk=None):
        """终止租户"""
        tenant = self.get_object()
        tenant.status = Tenant.Status.TERMINATED
        tenant.save()

        # 记录操作日志
        TenantOperationLog.objects.create(
            tenant=tenant,
            operation_type=TenantOperationLog.OperationType.TERMINATE,
            operation_detail=f"终止租户: {tenant.name}",
            operator=request.user
        )

        logger.info(f"用户 {request.user.username} 终止了租户 {tenant.name}")
        return Response({'detail': '租户已终止'}, status=status.HTTP_200_OK)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取租户统计信息"""
        queryset = self.get_queryset()

        # 基本统计
        total_count = queryset.count()
        active_count = queryset.filter(status=Tenant.Status.ACTIVE).count()
        suspended_count = queryset.filter(status=Tenant.Status.SUSPENDED).count()
        terminated_count = queryset.filter(status=Tenant.Status.TERMINATED).count()
        pending_count = queryset.filter(status=Tenant.Status.PENDING).count()

        # 按级别统计
        superior_count = queryset.filter(level=Tenant.TenantLevel.SUPERIOR).count()
        important_count = queryset.filter(level=Tenant.TenantLevel.IMPORTANT).count()
        ordinary_count = queryset.filter(level=Tenant.TenantLevel.ORDINARY).count()

        # 按类型统计
        virtual_count = queryset.filter(tenant_type=Tenant.TenantType.VIRTUAL).count()
        virtual_physical_count = queryset.filter(tenant_type=Tenant.TenantType.VIRTUAL_PHYSICAL).count()
        virtual_physical_network_count = queryset.filter(tenant_type=Tenant.TenantType.VIRTUAL_PHYSICAL_NETWORK).count()
        datacenter_cabinet_count = queryset.filter(tenant_type=Tenant.TenantType.DATACENTER_CABINET).count()

        # 资源统计
        from django.db.models import Sum
        resource_stats = queryset.aggregate(
            total_vcpus=Sum('quota_vcpus'),
            total_memory=Sum('quota_memory'),
            total_disk=Sum('quota_disk'),
            total_instances=Sum('quota_instances')
        )

        stats_data = {
            'total_count': total_count,
            'active_count': active_count,
            'suspended_count': suspended_count,
            'terminated_count': terminated_count,
            'pending_count': pending_count,
            'superior_count': superior_count,
            'important_count': important_count,
            'ordinary_count': ordinary_count,
            'virtual_count': virtual_count,
            'virtual_physical_count': virtual_physical_count,
            'virtual_physical_network_count': virtual_physical_network_count,
            'datacenter_cabinet_count': datacenter_cabinet_count,
            'total_vcpus': resource_stats['total_vcpus'] or 0,
            'total_memory': resource_stats['total_memory'] or 0,
            'total_disk': resource_stats['total_disk'] or 0,
            'total_instances': resource_stats['total_instances'] or 0,
        }

        serializer = TenantStatisticsSerializer(data=stats_data)
        serializer.is_valid(raise_exception=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def resource_usage(self, request, pk=None):
        """获取租户资源使用情况"""
        tenant = self.get_object()
        usage_records = TenantResourceUsage.objects.filter(tenant=tenant).order_by('-record_date')

        page = self.paginate_queryset(usage_records)
        if page is not None:
            serializer = TenantResourceUsageSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = TenantResourceUsageSerializer(usage_records, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def operation_logs(self, request, pk=None):
        """获取租户操作日志"""
        tenant = self.get_object()
        logs = TenantOperationLog.objects.filter(tenant=tenant).order_by('-operation_time')

        page = self.paginate_queryset(logs)
        if page is not None:
            serializer = TenantOperationLogSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = TenantOperationLogSerializer(logs, many=True)
        return Response(serializer.data)


class TenantResourceUsageViewSet(viewsets.ModelViewSet):
    """租户资源使用情况视图集"""

    queryset = TenantResourceUsage.objects.all()
    serializer_class = TenantResourceUsageSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['record_date', 'monthly_cost']
    ordering = ['-record_date']

    filterset_fields = {
        'tenant': ['exact'],
        'record_date': ['gte', 'lte'],
        'monthly_cost': ['gte', 'lte'],
    }


class TenantOperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """租户操作日志视图集（只读）"""

    queryset = TenantOperationLog.objects.all()
    serializer_class = TenantOperationLogSerializer
    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    ordering_fields = ['operation_time']
    ordering = ['-operation_time']

    filterset_fields = {
        'tenant': ['exact'],
        'operation_type': ['exact'],
        'operator': ['exact'],
        'operation_time': ['gte', 'lte'],
    }