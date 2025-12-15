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
    """管理员为指定租户创建虚拟机（同时在OpenStack中创建）"""
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
        
        vm_name = data.get('name')
        if not vm_name:
            return Response({
                'error': '缺少必要参数：name'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 先在数据库创建虚拟机记录
        vm = VirtualMachine.objects.create(
            information_system=system,
            name=vm_name,
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
        
        # 在 OpenStack 中创建虚拟机
        try:
            from apps.openstack.services import get_openstack_service
            openstack_service = get_openstack_service()
            
            # 获取启动源类型
            source_type = data.get('source_type', 'image')
            
            # 从请求中获取用户选择的资源 ID
            flavor_id = data.get('flavor_id')
            image_id = data.get('image_id')
            volume_id = data.get('volume_id')
            snapshot_id = data.get('snapshot_id')
            network_id = data.get('network_id')
            
            if not flavor_id:
                raise Exception('请选择实例类型')
            if not network_id:
                raise Exception('请选择网络')
            
            # 根据 source_type 验证必要参数
            if source_type in ['image', 'instance_snapshot']:
                if not image_id:
                    raise Exception('请选择镜像')
            elif source_type == 'volume':
                if not volume_id:
                    raise Exception('请选择卷')
            elif source_type == 'volume_snapshot':
                if not snapshot_id:
                    raise Exception('请选择卷快照')
            
            logger.info(f"管理员创建VM - 源类型: {source_type}, flavor_id: {flavor_id}, network_id: {network_id}")
            
            # 只有当 availability_zone 有值时才传递
            az = data.get('availability_zone')
            extra_kwargs = {}
            if az:
                extra_kwargs['availability_zone'] = az
            
            # 根据 source_type 调用不同的创建方法
            if source_type in ['image', 'instance_snapshot']:
                logger.info(f"从镜像创建: image_id={image_id}")
                server = openstack_service.create_server(
                    name=vm_name,
                    image_id=image_id,
                    flavor_id=flavor_id,
                    network_ids=[network_id],
                    **extra_kwargs
                )
            elif source_type == 'volume':
                logger.info(f"从卷创建: volume_id={volume_id}")
                server = openstack_service.create_server_from_volume(
                    name=vm_name,
                    volume_id=volume_id,
                    flavor_id=flavor_id,
                    network_ids=[network_id],
                    **extra_kwargs
                )
            elif source_type == 'volume_snapshot':
                logger.info(f"从卷快照创建: snapshot_id={snapshot_id}")
                server = openstack_service.create_server_from_snapshot(
                    name=vm_name,
                    snapshot_id=snapshot_id,
                    flavor_id=flavor_id,
                    network_ids=[network_id],
                    **extra_kwargs
                )
            else:
                raise Exception(f"不支持的启动源类型: {source_type}")
            
            # 更新虚拟机的 OpenStack ID
            vm.openstack_id = server.get('id')
            
            # 获取分配的 IP 地址
            addresses = server.get('addresses', {})
            if addresses:
                for network_name, addr_list in addresses.items():
                    if addr_list and len(addr_list) > 0:
                        vm.ip_address = addr_list[0].get('addr')
                        if 'OS-EXT-IPS-MAC:mac_addr' in addr_list[0]:
                            vm.mac_address = addr_list[0].get('OS-EXT-IPS-MAC:mac_addr')
                        break
            
            # 更新状态
            openstack_status = server.get('status', '').upper()
            if openstack_status == 'ACTIVE':
                vm.status = VirtualMachine.VMStatus.RUNNING
            elif openstack_status == 'BUILD':
                vm.status = VirtualMachine.VMStatus.STOPPED  # 创建中
            
            vm.save()
            
            logger.info(f"管理员 {request.user.username} 为租户 {system.tenant.name} 创建虚拟机: {vm.name} (OpenStack ID: {vm.openstack_id})")
            
            return Response({
                'success': True,
                'message': f'成功为租户 {system.tenant.name} 创建虚拟机（已同步到OpenStack）',
                'vm': {
                    'id': str(vm.id),
                    'name': vm.name,
                    'status': vm.status,
                    'cpu_cores': vm.cpu_cores,
                    'memory_gb': vm.memory_gb,
                    'disk_gb': vm.disk_gb,
                    'system_id': str(system.id),
                    'system_name': system.name,
                    'tenant_name': system.tenant.name,
                    'openstack_id': vm.openstack_id
                }
            }, status=status.HTTP_201_CREATED)
            
        except Exception as openstack_error:
            # OpenStack 创建失败，删除数据库记录
            logger.error(f"OpenStack 创建虚拟机失败: {str(openstack_error)}")
            vm.delete()
            return Response({
                'error': f'在OpenStack创建虚拟机失败: {str(openstack_error)}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_stop_virtual_machine(request, vm_id):
    """管理员停止租户的虚拟机（同时操作OpenStack）"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以停止租户虚拟机'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        with transaction.atomic():
            vm = VirtualMachine.objects.select_for_update().get(id=vm_id)
            
            # 检查虚拟机状态
            if vm.status == VirtualMachine.VMStatus.STOPPED:
                return Response({
                    'error': '虚拟机已处于停止状态'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # 如果有 OpenStack ID，通过 OpenStack API 停止
            if vm.openstack_id:
                openstack_service = get_openstack_service()
                success = openstack_service.stop_server(vm.openstack_id)
                
                if not success:
                    return Response({
                        'error': '停止虚拟机失败'
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # 更新虚拟机状态
            vm.status = VirtualMachine.VMStatus.STOPPED
            vm.save()
            
            # 记录操作日志
            VMOperationLog.objects.create(
                virtual_machine=vm,
                operation_type=VMOperationLog.OperationType.STOP,
                operation_detail=f'管理员停止虚拟机',
                operator=request.user,
                success=True
            )
            
            logger.info(f"管理员 {request.user.username} 停止虚拟机: {vm.name} (租户: {vm.information_system.tenant.name})")
            
            return Response({
                'success': True,
                'message': '虚拟机停止成功',
                'vm': {
                    'id': str(vm.id),
                    'name': vm.name,
                    'status': vm.status
                }
            })
            
    except VirtualMachine.DoesNotExist:
        return Response({
            'error': '虚拟机不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"管理员停止虚拟机失败: {str(e)}")
        return Response({
            'error': f'停止失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def admin_delete_virtual_machine(request, vm_id):
    """管理员删除租户的虚拟机（同时从OpenStack删除）"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以删除租户虚拟机'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        vm = VirtualMachine.objects.get(id=vm_id)
        vm_name = vm.name
        tenant_name = vm.information_system.tenant.name
        openstack_id = vm.openstack_id
        
        # 如果有 OpenStack ID，先从 OpenStack 删除
        if openstack_id:
            try:
                openstack_service = get_openstack_service()
                success = openstack_service.delete_server(openstack_id)
                if not success:
                    logger.warning(f"从 OpenStack 删除虚拟机失败: {vm_name} ({openstack_id})")
            except Exception as os_error:
                logger.error(f"OpenStack删除虚拟机出错: {str(os_error)}")
                # 继续删除数据库记录
        
        # 删除数据库记录
        vm.delete()
        
        logger.info(f"管理员 {request.user.username} 删除虚拟机: {vm_name} (租户: {tenant_name})")
        
        # 记录活动日志
        try:
            from apps.monitoring.models import ActivityLog
            ActivityLog.log_activity(
                action_type='delete',
                description=f'管理员 {request.user.username} 删除了虚拟机 {vm_name}',
                user=request.user,
                ip_address=request.META.get('REMOTE_ADDR')
            )
        except Exception as log_error:
            logger.warning(f'记录活动日志失败: {str(log_error)}')
        
        return Response({
            'success': True,
            'message': f'虚拟机 {vm_name} 已删除'
        })
        
    except VirtualMachine.DoesNotExist:
        return Response({
            'error': '虚拟机不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"管理员删除虚拟机失败: {str(e)}")
        return Response({
            'error': f'删除失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_resize_virtual_machine(request, vm_id):
    """管理员调整租户虚拟机配置（同时操作OpenStack）"""
    if not is_admin_user(request.user):
        return Response({
            'error': '权限不足：只有管理员可以调整租户虚拟机配置'
        }, status=status.HTTP_403_FORBIDDEN)

    try:
        data = request.data
        new_cpu = data.get('cpu_cores')
        new_memory = data.get('memory_gb')
        new_disk = data.get('disk_gb')
        
        vm = VirtualMachine.objects.get(id=vm_id)
        
        # 如果有 OpenStack ID，通过 OpenStack API 调整配置
        if vm.openstack_id and (new_cpu or new_memory):
            openstack_service = get_openstack_service()
            
            # 获取匹配的 flavor
            flavors = openstack_service.list_flavors()
            target_cpu = new_cpu or vm.cpu_cores
            target_ram = (new_memory or vm.memory_gb) * 1024
            
            new_flavor = None
            for f in flavors:
                if f.get('vcpus') >= target_cpu and f.get('ram') >= target_ram:
                    new_flavor = f
                    break
            
            if not new_flavor and flavors:
                new_flavor = flavors[0]
            
            if new_flavor:
                success = openstack_service.resize_server(vm.openstack_id, new_flavor['id'])
                if not success:
                    logger.warning(f"OpenStack resize 失败: {vm.name}")
        
        # 更新数据库记录
        old_config = f"CPU:{vm.cpu_cores}, 内存:{vm.memory_gb}GB, 磁盘:{vm.disk_gb}GB"
        
        if new_cpu:
            vm.cpu_cores = new_cpu
        if new_memory:
            vm.memory_gb = new_memory
        if new_disk:
            vm.disk_gb = new_disk
        
        vm.save()
        
        new_config = f"CPU:{vm.cpu_cores}, 内存:{vm.memory_gb}GB, 磁盘:{vm.disk_gb}GB"
        
        # 记录操作日志
        VMOperationLog.objects.create(
            virtual_machine=vm,
            operation_type=VMOperationLog.OperationType.RESIZE,
            operation_detail=f'管理员调整虚拟机配置: {old_config} -> {new_config}',
            operator=request.user,
            success=True
        )
        
        logger.info(f"管理员 {request.user.username} 调整虚拟机配置: {vm.name} ({old_config} -> {new_config})")
        
        return Response({
            'success': True,
            'message': '虚拟机配置调整成功',
            'vm': {
                'id': str(vm.id),
                'name': vm.name,
                'cpu_cores': vm.cpu_cores,
                'memory_gb': vm.memory_gb,
                'disk_gb': vm.disk_gb
            }
        })
        
    except VirtualMachine.DoesNotExist:
        return Response({
            'error': '虚拟机不存在'
        }, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        logger.error(f"管理员调整虚拟机配置失败: {str(e)}")
        return Response({
            'error': f'调整配置失败: {str(e)}'
        }, status=status.HTTP_400_BAD_REQUEST)
