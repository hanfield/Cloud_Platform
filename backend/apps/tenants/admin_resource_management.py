"""
管理员资源管理视图 - 专门处理管理员为租户创建和管理资源
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.utils import timezone
from django.db import transaction
import logging

from ..information_systems.models import InformationSystem, VirtualMachine, VMOperationLog
from ..tenants.models import Tenant
from ..openstack.services import get_openstack_service

logger = logging.getLogger(__name__)


def is_admin_user(user):
    """检查用户是否是管理员"""
    # 检查是否是超级用户或staff
    return user.is_superuser or user.is_staff


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_information_system(request):
    """管理员为指定租户创建信息系统"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以为租户创建信息系统'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        data = request.data
        tenant_id = data.get('tenant_id')
        
        if not tenant_id:
            return Response({
                'error': '缺少必要参数：tenant_id'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取租户
        try:
            tenant = Tenant.objects.get(id=tenant_id)
        except Tenant.DoesNotExist:
            return Response({
                'error': '租户不存在'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 创建信息系统
        system = InformationSystem.objects.create(
            tenant=tenant,
            name=data.get('name'),
            code=data.get('code'),
            description=data.get('description', ''),
            operation_mode=data.get('operation_mode', '7x24'),
            system_type=data.get('system_type', 'application'),
            status='stopped',
            created_by=request.user
        )
        
        logger.info(f"管理员 {request.user.username} 为租户 {tenant.name} 创建信息系统: {system.name}")
        
        return Response({
            'success': True,
            'message': f'成功为租户 {tenant.name} 创建信息系统',
            'system': {
                'id': str(system.id),
                'name': system.name,
                'code': system.code,
                'status': system.status,
                'tenant_id': str(tenant.id),
                'tenant_name': tenant.name
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"管理员创建信息系统失败: {str(e)}")
        return Response({
            'error': f'创建失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_create_virtual_machine(request):
    """管理员为指定租户创建虚拟机"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以为租户创建虚拟机'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        data = request.data
        system_id = data.get('system_id')
        
        if not system_id:
            return Response({
                'error': '缺少必要参数：system_id'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取信息系统
        try:
            system = InformationSystem.objects.get(id=system_id)
        except InformationSystem.DoesNotExist:
            return Response({
                'error': '信息系统不存在'
            }, status=status.HTTP_404_NOT_FOUND)
        
        # 创建虚拟机
        vm = VirtualMachine.objects.create(
            information_system=system,
            name=data.get('name'),
            cpu_cores=data.get('cpu_cores', 2),
            memory_gb=data.get('memory_gb', 4),
            disk_gb=data.get('disk_gb', 100),
            data_center_type=data.get('data_center_type', 'production'),
            availability_zone=data.get('availability_zone', ''),
            region=data.get('region', ''),
            runtime_start=data.get('runtime_start'),
            runtime_end=data.get('runtime_end'),
            os_type=data.get('os_type', 'Linux'),
            os_version=data.get('os_version', ''),
            description=data.get('description', ''),
            status=VirtualMachine.VMStatus.STOPPED,
            created_by=request.user
        )
        
        logger.info(f"管理员 {request.user.username} 为租户 {system.tenant.name} 创建虚拟机: {vm.name}")
        
        return Response({
            'success': True,
            'message': f'成功为租户 {system.tenant.name} 创建虚拟机',
            'vm': {
                'id': str(vm.id),
                'name': vm.name,
                'status': vm.status,
                'cpu_cores': vm.cpu_cores,
                'memory_gb': vm.memory_gb,
                'disk_gb': vm.disk_gb,
                'system_id': str(system.id),
                'system_name': system.name,
                'tenant_name': system.tenant.name
            }
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        logger.error(f"管理员创建虚拟机失败: {str(e)}")
        return Response({
            'error': f'创建失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_start_virtual_machine(request, vm_id):
    """管理员启动租户的虚拟机"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以启动租户虚拟机'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        with transaction.atomic():
            vm = VirtualMachine.objects.select_for_update().get(id=vm_id)
            
            # 检查虚拟机状态
            if vm.status == VirtualMachine.VMStatus.RUNNING:
                return Response({
                    'error': '虚拟机已在运行状态'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if vm.status == VirtualMachine.VMStatus.ERROR:
                return Response({
                    'error': '虚拟机处于错误状态，无法启动'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 如果有 OpenStack ID，通过 OpenStack API 启动
            if vm.openstack_id:
                openstack_service = get_openstack_service()
                success = openstack_service.start_server(vm.openstack_id)
                
                if not success:
                    return Response({
                        'error': '启动虚拟机失败'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # 更新虚拟机状态
            vm.status = VirtualMachine.VMStatus.RUNNING
            vm.last_start_time = timezone.now()
            vm.save()
            
            # 记录操作日志
            VMOperationLog.objects.create(
                virtual_machine=vm,
                operation_type=VMOperationLog.OperationType.START,
                operation_detail=f'管理员启动虚拟机',
                operator=request.user,
                success=True
            )
            
            logger.info(f"管理员 {request.user.username} 启动虚拟机: {vm.name} (租户: {vm.information_system.tenant.name})")
            
            return Response({
                'success': True,
                'message': '虚拟机启动成功',
                'vm': {
                    'id': str(vm.id),
                    'name': vm.name,
                    'status': vm.status,
                    'last_start_time': vm.last_start_time.strftime('%Y-%m-%d %H:%M:%S')
                }
            })
            
    except VirtualMachine.DoesNotExist:
        return Response({
            'error': '虚拟机不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"管理员启动虚拟机失败: {str(e)}")
        return Response({
            'error': f'启动失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_start_information_system(request, system_id):
    """管理员启动租户的信息系统"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以启动租户信息系统'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        from ..information_systems.models import SystemOperationLog, SystemResource
        
        system = InformationSystem.objects.get(id=system_id)
        
        # 检查系统状态
        if system.status == InformationSystem.Status.RUNNING:
            return Response({
                'error': '信息系统已在运行状态'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 启动所有关联的服务器资源
        openstack_service = get_openstack_service()
        for resource in system.resources.filter(
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
        system.status = InformationSystem.Status.RUNNING
        system.last_start_time = timezone.now()
        system.save()
        
        # 记录操作日志
        SystemOperationLog.objects.create(
            information_system=system,
            operation_type=SystemOperationLog.OperationType.START,
            operation_detail=f'管理员启动信息系统',
            operator=request.user
        )
        
        logger.info(f"管理员 {request.user.username} 启动信息系统: {system.name} (租户: {system.tenant.name})")
        
        return Response({
            'success': True,
            'message': '信息系统启动成功',
            'system': {
                'id': str(system.id),
                'name': system.name,
                'status': system.status,
                'last_start_time': system.last_start_time.strftime('%Y-%m-%d %H:%M:%S')
            }
        })
        
    except InformationSystem.DoesNotExist:
        return Response({
            'error': '信息系统不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"管理员启动信息系统失败: {str(e)}")
        return Response({
            'error': f'启动失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_all_tenants(request):
    """获取所有租户列表 - 供管理员选择"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以查看所有租户'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        tenants = Tenant.objects.all()
        tenants_data = []
        
        for tenant in tenants:
            tenants_data.append({
                'id': str(tenant.id),
                'name': tenant.name,
                'code': tenant.code,
                'status': tenant.status,
                'contact_person': tenant.contact_person,
                'contact_phone': tenant.contact_phone,
                'contact_email': tenant.contact_email,
                'systems_count': tenant.information_systems.count()
            })
        
        return Response({
            'success': True,
            'tenants': tenants_data,
            'total': len(tenants_data)
        })
        
    except Exception as e:
        logger.error(f"获取租户列表失败: {str(e)}")
        return Response({
            'error': f'获取失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
