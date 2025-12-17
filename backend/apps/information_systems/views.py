"""
信息系统管理API视图
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from django.utils import timezone
from .models import (
    InformationSystem, SystemResource, SystemOperationLog, SystemBillingRecord,
    VirtualMachine, DailyBillingRecord, ResourceAdjustmentLog, VMSnapshot
)
from .serializers import (
    InformationSystemSerializer,
    SystemResourceSerializer,
    SystemOperationLogSerializer,
    SystemBillingRecordSerializer,
    InformationSystemCreateSerializer,
    InformationSystemCreateSerializer,
    SystemResourceCreateSerializer,
    VMSnapshotSerializer
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
        """创建信息系统 - 管理员可为指定租户创建"""
        # 管理员可以通过传递 tenant_id 为特定租户创建
        # 租户用户则自动关联到自己的租户
        serializer.save(created_by=self.request.user)

    def perform_destroy(self, instance):
        """删除信息系统 - 同时删除所有关联的虚拟机"""
        from .models import VirtualMachine
        
        deleted_count = 0
        
        try:
            openstack_service = get_openstack_service()
            
            # 删除所有关联的虚拟机
            vms = VirtualMachine.objects.filter(information_system=instance)
            for vm in vms:
                if vm.openstack_id:
                    try:
                        openstack_service.delete_server(vm.openstack_id)
                        deleted_count += 1
                    except Exception as e:
                        # 记录日志但继续删除
                        pass
                vm.delete()
            
            # 记录操作日志
            SystemOperationLog.objects.create(
                information_system=instance,
                operation_type=SystemOperationLog.OperationType.DELETE,
                operation_detail=f"删除信息系统: {instance.name}，共删除 {deleted_count} 个虚拟机",
                operator=self.request.user
            )
            
        except Exception as e:
            # 即使 OpenStack 操作失败，也继续删除本地记录
            pass
        
        # 删除信息系统本身
        instance.delete()

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """启动信息系统及其所有虚拟机"""
        from .models import VirtualMachine
        
        information_system = self.get_object()

        try:
            openstack_service = get_openstack_service()
            started_count = 0
            failed_count = 0

            # 启动所有关联的虚拟机
            vms = VirtualMachine.objects.filter(information_system=information_system)
            for vm in vms:
                if vm.openstack_id and vm.status != VirtualMachine.VMStatus.RUNNING:
                    try:
                        success = openstack_service.start_server(vm.openstack_id)
                        if success:
                            vm.status = VirtualMachine.VMStatus.RUNNING
                            vm.last_start_time = timezone.now()
                            vm.save()
                            started_count += 1
                    except Exception as e:
                        failed_count += 1

            # 更新信息系统状态
            information_system.status = InformationSystem.Status.RUNNING
            information_system.last_start_time = timezone.now()
            information_system.save()

            # 记录操作日志
            SystemOperationLog.objects.create(
                information_system=information_system,
                operation_type=SystemOperationLog.OperationType.START,
                operation_detail=f"信息系统启动成功，共启动 {started_count} 个虚拟机" + (f"，{failed_count} 个失败" if failed_count else ""),
                operator=request.user
            )

            return Response({
                'status': 'success',
                'message': f'信息系统启动成功，共启动 {started_count} 个虚拟机'
            })

        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'启动失败: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=False, methods=['post'])
    def sync_openstack(self, request):
        """手动触发OpenStack同步"""
        # 只有管理员可以执行此操作
        if not request.user.is_staff:
            return Response({
                'error': '只有管理员可以执行同步操作'
            }, status=status.HTTP_403_FORBIDDEN)
            
        try:
            from django.core.management import call_command
            # 执行同步命令
            call_command('sync_openstack_vms', cleanup_deleted=True)
            
            return Response({
                'status': 'success',
                'message': 'OpenStack同步已完成'
            })
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'同步失败: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    @action(detail=True, methods=['post'])
    def stop(self, request, pk=None):
        """停止信息系统及其所有虚拟机"""
        from .models import VirtualMachine
        
        information_system = self.get_object()

        # 权限检查：只有所属租户的用户或管理员可以停止
        try:
            from ..tenants.user_models import UserProfile
            profile = UserProfile.objects.filter(
                user=request.user,
                tenant=information_system.tenant,
                status='active'
            ).first()
            
            if not profile and not request.user.is_staff:
                return Response({
                    'status': 'error',
                    'message': '权限不足：只有所属租户的用户可以停止信息系统'
                }, status=status.HTTP_403_FORBIDDEN)
        except Exception as e:
            return Response({
                'status': 'error',
                'message': f'权限验证失败: {str(e)}'
            }, status=status.HTTP_403_FORBIDDEN)

        try:
            openstack_service = get_openstack_service()
            stopped_count = 0
            failed_count = 0

            # 停止所有关联的虚拟机
            vms = VirtualMachine.objects.filter(information_system=information_system)
            for vm in vms:
                if vm.openstack_id and vm.status == VirtualMachine.VMStatus.RUNNING:
                    try:
                        success = openstack_service.stop_server(vm.openstack_id)
                        if success:
                            vm.status = VirtualMachine.VMStatus.STOPPED
                            vm.last_stop_time = timezone.now()
                            vm.save()
                            stopped_count += 1
                    except Exception as e:
                        failed_count += 1

            # 更新信息系统状态
            information_system.status = InformationSystem.Status.STOPPED
            information_system.last_stop_time = timezone.now()
            information_system.save()

            # 记录操作日志
            SystemOperationLog.objects.create(
                information_system=information_system,
                operation_type=SystemOperationLog.OperationType.STOP,
                operation_detail=f"信息系统停止成功，共停止 {stopped_count} 个虚拟机" + (f"，{failed_count} 个失败" if failed_count else ""),
                operator=request.user
            )

            return Response({
                'status': 'success',
                'message': f'信息系统停止成功，共停止 {stopped_count} 个虚拟机'
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

    @action(detail=True, methods=['get'])
    def detailed_info(self, request, pk=None):
        """获取信息系统的详细信息，包括产品、服务、虚拟机、计费记录等"""
        information_system = self.get_object()

        # 基本信息
        basic_info = InformationSystemSerializer(information_system).data

        # 关联的产品
        products_data = []
        for product in information_system.products.all():
            products_data.append({
                'id': product.id,
                'name': product.name,
                'product_type': product.product_type,
                'product_type_display': product.get_product_type_display(),
                'base_price': str(product.base_price),
                'billing_unit': product.get_billing_unit_display(),
                'cpu_capacity': product.cpu_capacity,
                'memory_capacity': product.memory_capacity,
                'storage_capacity': product.storage_capacity
            })

        # 关联的服务
        services_data = []
        for service in information_system.services.all():
            services_data.append({
                'id': service.id,
                'name': service.name,
                'service_type': service.service_type,
                'service_type_display': service.get_service_type_display(),
                'base_price': str(service.base_price),
                'billing_cycle': service.get_billing_cycle_display(),
                'sla_level': service.get_sla_level_display(),
                'description': service.description
            })

        # 虚拟机列表
        vms = VirtualMachine.objects.filter(information_system=information_system)
        vms_data = []
        for vm in vms:
            vms_data.append({
                'id': str(vm.id),
                'name': vm.name,
                'ip_address': vm.ip_address or '未分配',
                'cpu_cores': vm.cpu_cores,
                'memory_gb': vm.memory_gb,
                'disk_gb': vm.disk_gb,
                'status': vm.status,
                'status_display': vm.get_status_display(),
                'data_center_type': vm.data_center_type,
                'data_center_type_display': vm.get_data_center_type_display(),
                'availability_zone': vm.availability_zone or '-',
                'region': vm.region or '-',
                'runtime_display': vm.runtime_display,
                'os_type': vm.os_type or '未知',
                'last_start_time': vm.last_start_time.strftime('%Y-%m-%d %H:%M:%S') if vm.last_start_time else None,
                'created_at': vm.created_at.strftime('%Y-%m-%d %H:%M:%S')
            })

        # 按数据中心类型分组虚拟机
        vms_by_datacenter = {}
        for vm_data in vms_data:
            dc_type = vm_data['data_center_type_display']
            if dc_type not in vms_by_datacenter:
                vms_by_datacenter[dc_type] = []
            vms_by_datacenter[dc_type].append(vm_data)

        # 每日计费记录（最近30天）
        daily_billing = DailyBillingRecord.objects.filter(
            information_system=information_system
        ).order_by('-billing_date')[:30]

        daily_billing_data = []
        for record in daily_billing:
            daily_billing_data.append({
                'billing_date': record.billing_date.strftime('%Y-%m-%d'),
                'cpu_cores': record.cpu_cores,
                'memory_gb': record.memory_gb,
                'storage_gb': record.storage_gb,
                'running_hours': record.running_hours,
                'hourly_rate': str(record.hourly_rate),
                'daily_cost': str(record.daily_cost),
                'actual_daily_cost': str(record.actual_daily_cost),
                'discount_rate': str(record.discount_rate)
            })

        # 资源调整历史（最近10条）
        adjustments = ResourceAdjustmentLog.objects.filter(
            information_system=information_system
        ).order_by('-adjustment_date')[:10]

        adjustments_data = []
        for adj in adjustments:
            adjustments_data.append({
                'adjustment_type': adj.get_adjustment_type_display(),
                'old_cpu': adj.old_cpu_cores,
                'new_cpu': adj.new_cpu_cores,
                'old_memory': adj.old_memory_gb,
                'new_memory': adj.new_memory_gb,
                'old_storage': adj.old_storage_gb,
                'new_storage': adj.new_storage_gb,
                'adjustment_date': adj.adjustment_date.strftime('%Y-%m-%d %H:%M:%S'),
                'effective_date': adj.effective_date.strftime('%Y-%m-%d'),
                'adjustment_detail': adj.adjustment_detail,
                'operator': adj.operator.username if adj.operator else '系统',
                'cost_impact': str(adj.cost_impact)
            })

        # 计算当月费用
        from datetime import date
        current_month = date.today().replace(day=1)
        monthly_billing = DailyBillingRecord.objects.filter(
            information_system=information_system,
            billing_date__gte=current_month
        )

        monthly_cost = sum([float(record.actual_daily_cost) for record in monthly_billing])

        return Response({
            'basic_info': basic_info,
            'products': products_data,
            'services': services_data,
            'virtual_machines': vms_data,
            'vms_by_datacenter': vms_by_datacenter,
            'daily_billing': daily_billing_data,
            'resource_adjustments': adjustments_data,
            'monthly_cost': monthly_cost,
            'total_vms': len(vms_data),
            'running_vms': len([vm for vm in vms_data if vm['status'] == 'running'])
        })

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


class VMSnapshotViewSet(viewsets.ModelViewSet):
    """虚拟机快照视图集"""

    permission_classes = [IsAuthenticated]
    serializer_class = VMSnapshotSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['virtual_machine', 'status']

    def get_queryset(self):
        return VMSnapshot.objects.select_related('virtual_machine', 'created_by').all()

    def perform_create(self, serializer):
        """创建快照"""
        # 1. 保存数据库记录 (状态: creating)
        snapshot = serializer.save(created_by=self.request.user, status='creating')
        
        # 2. 触发异步任务 (调用OpenStack)
        # TODO: Implement Celery task
        # create_snapshot_task.delay(snapshot.id)
        
        # 暂时同步调用以便测试 (后续移至Celery)
        try:
            openstack_service = get_openstack_service()
            vm = snapshot.virtual_machine
            if vm.openstack_id:
                image_id = openstack_service.create_server_snapshot(vm.openstack_id, snapshot.name)
                if image_id:
                    snapshot.openstack_image_id = image_id
                    snapshot.status = 'available'  # 成功后更新状态
                    snapshot.save()
                else:
                    snapshot.status = 'error'
                    snapshot.description = (snapshot.description or '') + " (Error: OpenStack returned no image ID)"
                    snapshot.save()
            else:
                snapshot.status = 'error'
                snapshot.description = (snapshot.description or '') + " (Error: VM has no OpenStack ID)"
                snapshot.save()
        except Exception as e:
            snapshot.status = 'error'
            snapshot.description = (snapshot.description or '') + f" (Error: {str(e)})"
            snapshot.save()

    @action(detail=True, methods=['post'])
    def restore(self, request, pk=None):
        """恢复快照 (回滚)"""
        snapshot = self.get_object()
        
        if not snapshot.openstack_image_id:
            return Response({'error': '快照未就绪 (无ImageID)'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            openstack_service = get_openstack_service()
            vm = snapshot.virtual_machine
            
            # 1. 更新状态
            snapshot.status = 'restoring'
            snapshot.save()
            
            # 2. 调用OpenStack重建
            success = openstack_service.rebuild_server(vm.openstack_id, snapshot.openstack_image_id)
            
            if success:
                snapshot.status = 'available'
                snapshot.save()
                return Response({'status': 'success', 'message': '快照回滚指令已发送'})
            else:
                snapshot.status = 'error'
                snapshot.save()
                return Response({'error': '回滚失败'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            snapshot.status = 'error'
            snapshot.save()
            return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    def perform_destroy(self, instance):
        """删除快照"""
        # 1. 删除OpenStack镜像
        if instance.openstack_image_id:
            try:
                openstack_service = get_openstack_service()
                openstack_service.delete_image(instance.openstack_image_id)
            except Exception as e:
                # 记录日志但允许删除本地记录
                pass
        
        # 2. 删除本地记录
        instance.delete()