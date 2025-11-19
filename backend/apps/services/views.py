"""
服务管理视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Count, Q
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter

from .models import Service, ServiceSubscription
from .serializers import (
    ServiceSerializer, ServiceCreateSerializer,
    ServiceSubscriptionSerializer, ServiceSubscriptionCreateSerializer,
    ServiceStatisticsSerializer, SubscriptionStatisticsSerializer
)


class ServiceViewSet(viewsets.ModelViewSet):
    """服务视图集"""

    queryset = Service.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['service_type', 'status', 'availability', 'mttr', 'rpo', 'rto']
    search_fields = ['name', 'code', 'description']
    ordering_fields = ['name', 'base_price', 'created_at', 'updated_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ServiceCreateSerializer
        return ServiceSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """服务统计信息"""
        queryset = self.get_queryset()

        # 基础统计
        total_services = queryset.count()
        active_services = queryset.filter(status='active').count()
        inactive_services = queryset.filter(status='inactive').count()
        draft_services = queryset.filter(status='draft').count()

        # 服务类型分布
        service_types = queryset.values('service_type').annotate(
            count=Count('id')
        ).order_by('-count')
        service_types_dict = {
            item['service_type']: item['count']
            for item in service_types
        }

        # 可用性级别分布
        availability_levels = queryset.values('availability').annotate(
            count=Count('id')
        ).order_by('-count')
        availability_levels_dict = {
            item['availability']: item['count']
            for item in availability_levels
        }

        statistics_data = {
            'total_count': total_services,
            'active_count': active_services,
            'inactive_count': inactive_services,
            'draft_count': draft_services,
            'subscription_count': 0,  # TODO: 实现订阅数统计
            'monthly_revenue': 0,  # TODO: 实现月收入统计
            'service_types': service_types_dict,
            'availability_levels': availability_levels_dict
        }

        serializer = ServiceStatisticsSerializer(statistics_data)
        return Response(serializer.data)


class ServiceSubscriptionViewSet(viewsets.ModelViewSet):
    """服务订阅视图集"""

    queryset = ServiceSubscription.objects.all()
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['tenant', 'service', 'contract', 'status']
    search_fields = ['tenant__name', 'service__name', 'contract__contract_number']
    ordering_fields = ['start_date', 'end_date', 'monthly_cost', 'created_at']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.action == 'create':
            return ServiceSubscriptionCreateSerializer
        return ServiceSubscriptionSerializer

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """订阅统计信息"""
        queryset = self.get_queryset()

        # 基础统计
        total_subscriptions = queryset.count()
        active_subscriptions = queryset.filter(status='active').count()
        suspended_subscriptions = queryset.filter(status='suspended').count()
        terminated_subscriptions = queryset.filter(status='terminated').count()

        # 按服务统计
        subscription_by_service = queryset.values(
            'service__name'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        subscription_by_service_dict = {
            item['service__name']: item['count']
            for item in subscription_by_service
        }

        # 按租户统计
        subscription_by_tenant = queryset.values(
            'tenant__name'
        ).annotate(
            count=Count('id')
        ).order_by('-count')
        subscription_by_tenant_dict = {
            item['tenant__name']: item['count']
            for item in subscription_by_tenant
        }

        statistics_data = {
            'total_subscriptions': total_subscriptions,
            'active_subscriptions': active_subscriptions,
            'suspended_subscriptions': suspended_subscriptions,
            'terminated_subscriptions': terminated_subscriptions,
            'subscription_by_service': subscription_by_service_dict,
            'subscription_by_tenant': subscription_by_tenant_dict
        }

        serializer = SubscriptionStatisticsSerializer(statistics_data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def tenant_subscriptions(self, request):
        """获取租户的服务订阅"""
        tenant_id = request.query_params.get('tenant_id')
        if not tenant_id:
            return Response(
                {'error': 'tenant_id参数是必需的'},
                status=status.HTTP_400_BAD_REQUEST
            )

        subscriptions = self.get_queryset().filter(
            tenant_id=tenant_id,
            status='active'
        )
        serializer = self.get_serializer(subscriptions, many=True)
        return Response(serializer.data)