"""
信息系统管理API视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import InformationSystem, SystemResource, SystemOperationLog, SystemBillingRecord
from .serializers import (
    InformationSystemSerializer,
    SystemResourceSerializer,
    SystemOperationLogSerializer,
    SystemBillingRecordSerializer,
    InformationSystemCreateSerializer,
    SystemResourceCreateSerializer
)
from ..openstack.services import get_openstack_service


class InformationSystemViewSet(viewsets.ModelViewSet):
    """信息系统视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'system_type', 'operation_mode', 'tenant']

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return InformationSystem.objects.select_related('tenant', 'created_by').all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return InformationSystemCreateSerializer
        return InformationSystemSerializer

    def perform_create(self, serializer):
        """创建信息系统"""
        serializer.save(created_by=self.request.user)

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """启动信息系统"""
        information_system = self.get_object()

        try:
            # 调用OpenStack服务启动相关资源
            openstack_service = get_openstack_service()

            # 启动所有关联的服务器资源
            for resource in information_system.resources.filter(
                openstack_resource_type='server',
                status='inactive'
            ):
                if resource.openstack_resource_id:
                    success = openstack_service.start_server(resource.openstack_resource_id)
                    if success:
                        resource.status = SystemResource.ResourceStatus.ACTIVE
                        resource.start_time = timezone.now()
                        resource.save()

            # 更新信息系统状态
            information_system.status = InformationSystem.Status.RUNNING
            information_system.last_start_time = timezone.now()
            information_system.save()

            # 记录操作日志
            SystemOperationLog.objects.create(
                information_system=information_system,
                operation_type=SystemOperationLog.OperationType.START,
                operation_detail=f"信息系统启动成功",
                operator=request.user
            )

            return Response({
                'status': 'success',
                'message': '信息系统启动成功'
            })

        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'启动失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """停止信息系统"""
        information_system = self.get_object()

        try:
            # 调用OpenStack服务停止相关资源
            openstack_service = get_openstack_service()

            # 停止所有关联的服务器资源
            for resource in information_system.resources.filter(
                openstack_resource_type='server',
                status='active'
            ):
                if resource.openstack_resource_id:
                    success = openstack_service.stop_server(resource.openstack_resource_id)
                    if success:
                        resource.status = SystemResource.ResourceStatus.INACTIVE
                        resource.running_time = timezone.now() - resource.start_time
                        resource.save()

            # 更新信息系统状态
            information_system.status = InformationSystem.Status.STOPPED
            information_system.last_stop_time = timezone.now()
            information_system.save()

            # 记录操作日志
            SystemOperationLog.objects.create(
                information_system=information_system,
                operation_type=SystemOperationLog.OperationType.STOP,
                operation_detail=f"信息系统停止成功",
                operator=request.user
            )

            return Response({
                'status': 'success',
                'message': '信息系统停止成功'
            })

        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'停止失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['post'])
    def maintenance(self, request, pk=None):
        """设置信息系统为维护状态"""
        information_system = self.get_object()

        information_system.status = InformationSystem.Status.MAINTENANCE
        information_system.save()

        # 记录操作日志
        SystemOperationLog.objects.create(
            information_system=information_system,
            operation_type=SystemOperationLog.OperationType.MAINTENANCE,
            operation_detail=f"信息系统进入维护状态",
            operator=request.user
        )

        return Response({
            'status': 'success',
            'message': '信息系统已设置为维护状态'
        })

    @action(detail=True, methods=['get'])
    def resources(self, request, pk=None):
        """获取信息系统资源列表"""
        information_system = self.get_object()
        resources = information_system.resources.all()
        serializer = SystemResourceSerializer(resources, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def operation_logs(self, request, pk=None):
        """获取信息系统操作日志"""
        information_system = self.get_object()
        logs = information_system.operation_logs.all()
        serializer = SystemOperationLogSerializer(logs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get'])
    def billing_records(self, request, pk=None):
        """获取信息系统计费记录"""
        information_system = self.get_object()
        records = information_system.billing_records.all()
        serializer = SystemBillingRecordSerializer(records, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """获取信息系统统计信息"""
        total_systems = InformationSystem.objects.count()
        running_systems = InformationSystem.objects.filter(
            status=InformationSystem.Status.RUNNING
        ).count()
        stopped_systems = InformationSystem.objects.filter(
            status=InformationSystem.Status.STOPPED
        ).count()
        maintenance_systems = InformationSystem.objects.filter(
            status=InformationSystem.Status.MAINTENANCE
        ).count()

        # 资源总量统计
        total_cpu = sum(system.total_cpu for system in InformationSystem.objects.all())
        total_memory = sum(system.total_memory for system in InformationSystem.objects.all())
        total_storage = sum(system.total_storage for system in InformationSystem.objects.all())

        return Response({
            'total_systems': total_systems,
            'running_systems': running_systems,
            'stopped_systems': stopped_systems,
            'maintenance_systems': maintenance_systems,
            'total_cpu': total_cpu,
            'total_memory': total_memory,
            'total_storage': total_storage
        })


class SystemResourceViewSet(viewsets.ModelViewSet):
    """系统资源视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['resource_type', 'status', 'information_system']

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return SystemResource.objects.select_related('information_system').all()

    def get_serializer_class(self):
        """根据操作类型选择序列化器"""
        if self.action == 'create':
            return SystemResourceCreateSerializer
        return SystemResourceSerializer

    def perform_create(self, serializer):
        """创建系统资源"""
        serializer.save()

    @action(detail=True, methods=['get'])
    def sync_openstack(self, request, pk=None):
        """同步OpenStack资源信息"""
        resource = self.get_object()

        if not resource.openstack_resource_id:
            return Response({
                'status': 'error',
                'message': '该资源未关联OpenStack资源'
            }, status=status.HTTP_400_BAD_REQUEST)

        try:
            openstack_service = get_openstack_service()

            if resource.openstack_resource_type == 'server':
                server_info = openstack_service.get_server_detailed_info(
                    resource.openstack_resource_id
                )

                if server_info:
                    # 更新资源状态
                    resource.status = (
                        SystemResource.ResourceStatus.ACTIVE
                        if server_info.get('status') == 'ACTIVE'
                        else SystemResource.ResourceStatus.INACTIVE
                    )

                    # 更新运行时间
                    if server_info.get('running_time'):
                        resource.running_time = server_info['running_time']

                    resource.save()

                    return Response({
                        'status': 'success',
                        'message': '资源信息同步成功',
                        'data': server_info
                    })

            return Response({
                'status': 'error',
                'message': '同步失败：资源类型不支持或资源不存在'
            }, status=status.HTTP_400_BAD_REQUEST)

        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'同步失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)


class SystemBillingRecordViewSet(viewsets.ReadOnlyModelViewSet):
    """系统计费记录视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['information_system', 'billing_period', 'is_paid']
    serializer_class = SystemBillingRecordSerializer

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return SystemBillingRecord.objects.select_related('information_system').all()


class SystemOperationLogViewSet(viewsets.ReadOnlyModelViewSet):
    """系统操作日志视图集"""

    permission_classes = [IsAuthenticated]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['information_system', 'operation_type', 'operator']
    serializer_class = SystemOperationLogSerializer

    def get_queryset(self):
        """根据用户权限返回查询集"""
        return SystemOperationLog.objects.select_related(
            'information_system', 'operator'
        ).all()