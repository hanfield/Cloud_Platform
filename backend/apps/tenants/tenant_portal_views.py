"""
租户门户视图 - 租户自助服务功能
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from django.db import transaction
from django.utils import timezone
from django.core.cache import cache
from contextlib import contextmanager
import logging
import random

from .models import Tenant, Stakeholder
from .user_models import UserProfile
from ..information_systems.models import InformationSystem, VirtualMachine, VMOperationLog
from ..products.models import Product, ProductSubscription
from ..services.models import Service, ServiceSubscription
from ..openstack.services import get_openstack_service

logger = logging.getLogger(__name__)


# ==================== VM 操作并发控制 ====================

class VMOperationConflictError(Exception):
    """VM 操作冲突异常"""
    pass


@contextmanager
def vm_operation_lock(vm_id, timeout=60):
    """
    VM 操作分布式锁
    - 使用 Redis/Django cache 实现跨进程锁
    - 同一 VM 同一时刻只能执行一个操作
    - 超时自动释放防止死锁
    
    Args:
        vm_id: 虚拟机 ID
        timeout: 锁超时时间（秒），默认60秒
    
    Raises:
        VMOperationConflictError: 锁被占用时抛出
    """
    lock_key = f'vm_operation_lock:{vm_id}'
    
    # 尝试获取锁
    acquired = cache.add(lock_key, 'locked', timeout)
    if not acquired:
        raise VMOperationConflictError('该虚拟机正在执行其他操作，请稍后重试')
    
    try:
        yield
    finally:
        # 释放锁
        cache.delete(lock_key)


def push_vm_status_update(vm, action=None, operating=False):
    """
    通过 WebSocket 推送 VM 状态更新
    
    Args:
        vm: VirtualMachine 实例
        action: 正在执行的操作（start/stop/reboot等）
        operating: 是否正在操作中
    """
    try:
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync
        
        channel_layer = get_channel_layer()
        if not channel_layer:
            logger.warning('WebSocket channel layer 未配置')
            return
        
        # 获取租户 ID 用于确定推送目标
        tenant_id = str(vm.information_system.tenant.id)
        
        message = {
            'type': 'vm_status_update',
            'vm_id': str(vm.id),
            'openstack_id': vm.openstack_id,
            'name': vm.name,
            'status': 'operating' if operating else vm.status,
            'action': action,
            'timestamp': timezone.now().isoformat(),
        }
        
        # 推送到租户组
        async_to_sync(channel_layer.group_send)(
            f'tenant_{tenant_id}',
            message
        )
        
        # 同时推送到管理员组
        async_to_sync(channel_layer.group_send)(
            'admin_notifications',
            message
        )
        
        logger.debug(f'推送 VM 状态更新: {vm.name} -> {message["status"]}')
        
    except Exception as e:
        # WebSocket 推送失败不应影响主流程
        logger.warning(f'推送 VM 状态更新失败: {str(e)}')




def find_suitable_flavor(cpu_cores, memory_gb, disk_gb):
    """根据配置查找合适的 OpenStack flavor"""
    try:
        openstack_service = get_openstack_service()
        flavors = openstack_service.list_flavors()

        # 查找完全匹配或略大于需求的 flavor
        suitable_flavors = []
        for flavor in flavors:
            vcpus = flavor.get('vcpus', 0)
            ram_gb = flavor.get('ram', 0) / 1024  # 转换为 GB
            disk = flavor.get('disk', 0)

            # 如果 flavor 的资源大于等于需求
            if vcpus >= cpu_cores and ram_gb >= memory_gb and disk >= disk_gb:
                # 计算资源差距（用于选择最合适的）
                diff = abs(vcpus - cpu_cores) + abs(ram_gb - memory_gb) + abs(disk - disk_gb)
                suitable_flavors.append((diff, flavor))

        # 排序并返回最接近的 flavor
        if suitable_flavors:
            suitable_flavors.sort(key=lambda x: x[0])
            return suitable_flavors[0][1]

        # 如果没有找到，返回 None
        logger.warning(f"未找到合适的 flavor: CPU={cpu_cores}, Memory={memory_gb}GB, Disk={disk_gb}GB")
        return None

    except Exception as e:
        logger.error(f"查找 flavor 失败: {str(e)}")
        return None


def find_suitable_image(os_type, os_version=None):
    """根据操作系统类型查找合适的镜像"""
    try:
        openstack_service = get_openstack_service()
        images = openstack_service.list_images()

        # 根据 os_type 查找镜像
        os_type_lower = os_type.lower() if os_type else ''

        for image in images:
            image_name = image.get('name', '').lower()

            # 检查镜像名称是否包含操作系统类型
            if os_type_lower in image_name:
                # 如果指定了版本，也检查版本
                if os_version and os_version.lower() in image_name:
                    return image
                # 如果没有指定版本，返回第一个匹配的
                elif not os_version:
                    return image

        # 如果没有找到匹配的，返回第一个可用的镜像
        if images:
            logger.warning(f"未找到匹配 {os_type} 的镜像，使用默认镜像")
            return images[0]

        logger.error("未找到任何可用镜像")
        return None

    except Exception as e:
        logger.error(f"查找镜像失败: {str(e)}")
        return None


def get_default_network(tenant):
    """获取租户的默认网络"""
    try:
        openstack_service = get_openstack_service()

        # 如果租户有 OpenStack 项目 ID，使用它
        project_id = getattr(tenant, 'openstack_project_id', None)

        networks = openstack_service.list_networks(project_id=project_id)

        # 返回第一个可用网络，优先选择名称包含 'private' 或 'internal' 的
        for network in networks:
            network_name = network.get('name', '').lower()
            if 'private' in network_name or 'internal' in network_name:
                return network

        # 如果没有找到 private 网络，返回第一个
        if networks:
            return networks[0]

        logger.warning(f"租户 {tenant.name} 没有可用网络")
        return None

    except Exception as e:
        logger.error(f"获取默认网络失败: {str(e)}")
        return None


def get_user_tenant(user):
    """获取用户关联的租户"""
    try:
        logger.info(f"获取用户租户: user={user}, user.id={user.id}")
        profile = user.profile
        logger.info(f"用户profile: profile_id={profile.id}, tenant={profile.tenant}")
        if profile.tenant:
            return profile.tenant
        # 如果用户profile没有租户，返回None
        logger.warning(f"用户{user.username}的profile没有关联租户")
        return None
    except UserProfile.DoesNotExist:
        # 如果用户没有profile，返回None
        logger.error(f"用户{user.username}没有profile")
        return None
    except Exception as e:
        logger.error(f"获取用户租户异常: {str(e)}", exc_info=True)
        return None


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_profile(request):
    """获取当前租户的基本信息和干系人信息"""
    try:
        tenant = get_user_tenant(request.user)

        if not tenant:
            return Response({'error': '未找到租户信息，请联系管理员'}, status=status.HTTP_404_NOT_FOUND)
        
        # 获取干系人信息
        stakeholders = Stakeholder.objects.filter(tenant=tenant)
        stakeholder_data = []
        for sh in stakeholders:
            stakeholder_data.append({
                'id': sh.id,
                'stakeholder_type': sh.stakeholder_type,
                'stakeholder_type_display': sh.get_stakeholder_type_display(),
                'name': sh.name,
                'phone': sh.phone,  # 已加密
                'email': sh.email,  # 已加密
                'department': sh.department,
                'position': sh.position,
                'is_primary': sh.is_primary
            })
        
        # 租户基本信息
        tenant_data = {
            'id': str(tenant.id),
            'name': tenant.name,
            'code': tenant.code,
            'status': tenant.status,
            'status_display': tenant.get_status_display(),
            'tenant_type': tenant.tenant_type,
            'tenant_type_display': tenant.get_tenant_type_display(),
            'level': tenant.level,
            'level_display': tenant.get_level_display(),
            'contact_person': tenant.contact_person,
            'contact_phone': tenant.contact_phone,
            'contact_email': tenant.contact_email,
            'address': tenant.address,
            'openstack_project_id': getattr(tenant, 'openstack_project_id', None),
            'stakeholders': stakeholder_data
        }
        
        return Response(tenant_data)
    except Exception as e:
        logger.error(f"获取租户信息失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_systems_overview(request):
    """获取租户的信息系统概览"""
    try:
        tenant = get_user_tenant(request.user)

        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        # 获取租户的所有信息系统
        systems = InformationSystem.objects.filter(tenant=tenant)
        
        systems_data = []
        for system in systems:
            # Calculate running time display
            running_time_display = "未运行"
            if system.running_time:
                total_seconds = int(system.running_time.total_seconds())
                days = total_seconds // 86400
                hours = (total_seconds % 86400) // 3600
                minutes = (total_seconds % 3600) // 60
                if days > 0:
                    running_time_display = f"{days}天{hours}小时{minutes}分钟"
                elif hours > 0:
                    running_time_display = f"{hours}小时{minutes}分钟"
                else:
                    running_time_display = f"{minutes}分钟"

            systems_data.append({
                'id': str(system.id),
                'name': system.name,
                'code': system.code,
                'status': system.status,
                'status_display': system.get_status_display(),
                'operation_mode': system.operation_mode,
                'operation_mode_display': system.get_operation_mode_display(),
                'description': system.description,
                'running_time': running_time_display,
                'created_at': system.created_at
            })
        
        overview = {
            'total_systems': systems.count(),
            'active_systems': systems.filter(status='running').count(),
            'systems': systems_data
        }
        
        return Response(overview)
    except Exception as e:
        logger.error(f"获取信息系统概览失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_orders(request):
    """获取租户的订单信息 - 包括虚拟机、存储、网络等资源"""
    try:
        tenant = get_user_tenant(request.user)

        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        # 获取信息系统及其资源（使用prefetch_related优化N+1查询）
        systems = InformationSystem.objects.filter(tenant=tenant).prefetch_related('virtual_machines')

        orders_data = []
        for system in systems:
            # 获取虚拟机信息（已通过prefetch_related预加载）
            vms = system.virtual_machines.all()
            vm_resources = []
            for vm in vms:
                # Calculate uptime display
                uptime_display = "未运行"
                if vm.uptime:
                    total_seconds = int(vm.uptime.total_seconds())
                    days = total_seconds // 86400
                    hours = (total_seconds % 86400) // 3600
                    minutes = (total_seconds % 3600) // 60
                    if days > 0:
                        uptime_display = f"{days}天{hours}小时{minutes}分钟"
                    elif hours > 0:
                        uptime_display = f"{hours}小时{minutes}分钟"
                    else:
                        uptime_display = f"{minutes}分钟"

                vm_resources.append({
                    'id': str(vm.id),
                    'openstack_id': vm.openstack_id,  # OpenStack ID for status/display
                    'name': vm.name,
                    'ip': vm.ip_address or '未分配',
                    'runtime': vm.runtime_display,  # Scheduled runtime
                    'uptime': uptime_display,       # Actual running time
                    'status': vm.status,
                    'status_display': vm.get_status_display(),
                    'cpu': vm.cpu_cores,
                    'memory': vm.memory_gb,
                    'disk': vm.disk_gb,
                    'os_type': vm.os_type or '未知',
                    'created_at': vm.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                    'data_center_type': vm.data_center_type,
                    'data_center_type_display': vm.get_data_center_type_display(),
                    'availability_zone': vm.availability_zone or '-',
                    'region': vm.region or '-',
                    'last_start_time': vm.last_start_time.strftime('%Y-%m-%d %H:%M:%S') if vm.last_start_time else None,
                })

            # 存储信息（根据系统总存储计算）
            total_vm_storage = sum([vm.disk_gb for vm in vms])
            storage_info = {
                'subscribed_capacity': system.total_storage,  # GB
                'used_capacity': total_vm_storage,
                'available_capacity': max(0, system.total_storage - total_vm_storage)
            }

            # 网络信息
            network_info = {
                'line_type': '数据专线',
                'bandwidth': 100,  # Mbps
                'start_time': system.created_at.strftime('%Y-%m-%d'),
                'status': 'active' if system.status == 'running' else 'inactive'
            }

            orders_data.append({
                'system_id': str(system.id),
                'system_name': system.name,
                'vm_resources': vm_resources,
                'storage': storage_info,
                'network': network_info
            })

        return Response({
            'orders': orders_data,
            'total_systems': len(orders_data)
        })
    except Exception as e:
        logger.error(f"获取订单信息失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def control_resource(request):
    """控制资源的启停 - 通过 OpenStack API"""
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        resource_id = request.data.get('resource_id')
        resource_type = request.data.get('resource_type')  # vm, storage, network
        action = request.data.get('action')  # start, stop, restart

        if not all([resource_id, resource_type, action]):
            return Response({'error': '缺少必要参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 处理虚拟机控制
        if resource_type == 'vm':
            try:
                # 首先尝试获取分布式锁（跨进程并发控制）
                with vm_operation_lock(resource_id):
                    # 使用事务和select_for_update防止数据库级别并发
                    with transaction.atomic():
                        vm = VirtualMachine.objects.select_for_update().get(id=resource_id)


                    # 验证虚拟机属于该租户
                    if vm.information_system.tenant != tenant:
                        return Response({'error': '无权操作此资源'}, status=status.HTTP_403_FORBIDDEN)

                    # 检查虚拟机是否有 OpenStack ID
                    if not vm.openstack_id:
                        logger.warning(f"虚拟机 {vm.id} 未绑定 OpenStack 实例")
                        return Response({
                            'error': '虚拟机未绑定 OpenStack 实例，无法执行操作'
                        }, status=status.HTTP_400_BAD_REQUEST)

                    # 状态检查：验证当前状态是否允许执行该操作
                    current_status = vm.status
                    logger.info(f"虚拟机 {vm.id} 当前状态: {current_status}, 请求操作: {action}")
                    
                    if action == 'start':
                        if current_status == VirtualMachine.VMStatus.RUNNING:
                            logger.warning(f"虚拟机 {vm.id} 已在运行，无需启动")
                            return Response({
                                'error': '虚拟机已在运行状态，无需启动'
                            }, status=status.HTTP_400_BAD_REQUEST)
                        if current_status == VirtualMachine.VMStatus.ERROR:
                            logger.warning(f"虚拟机 {vm.id} 处于错误状态")
                            return Response({
                                'error': '虚拟机处于错误状态，无法启动，请联系管理员'
                            }, status=status.HTTP_400_BAD_REQUEST)
                    elif action == 'stop':
                        if current_status == VirtualMachine.VMStatus.STOPPED:
                            logger.warning(f"虚拟机 {vm.id} 已停止，无需停止")
                            return Response({
                                'error': '虚拟机已停止，无需再次停止'
                            }, status=status.HTTP_400_BAD_REQUEST)
                    elif action == 'restart':
                        if current_status == VirtualMachine.VMStatus.STOPPED:
                            logger.warning(f"虚拟机 {vm.id} 已停止，无法重启")
                            return Response({
                                'error': '虚拟机已停止，无法重启，请先启动'
                            }, status=status.HTTP_400_BAD_REQUEST)
                        if current_status == VirtualMachine.VMStatus.ERROR:
                            logger.warning(f"虚拟机 {vm.id} 处于错误状态")
                            return Response({
                                'error': '虚拟机处于错误状态，无法重启，请联系管理员'
                            }, status=status.HTTP_400_BAD_REQUEST)

                    # 通过 OpenStack API 执行操作
                    openstack_service = get_openstack_service()
                    operation_success = False
                    operation_detail = ''

                    # 推送"操作中"状态到前端
                    push_vm_status_update(vm, action=action, operating=True)

                    try:
                        if action == 'start':
                            operation_success = openstack_service.start_server(vm.openstack_id)
                            if operation_success:
                                vm.status = VirtualMachine.VMStatus.RUNNING
                                vm.last_start_time = timezone.now()
                                operation_detail = f'虚拟机 {vm.name} 已启动'
                            else:
                                operation_detail = f'启动虚拟机 {vm.name} 失败'

                        elif action == 'stop':
                            operation_success = openstack_service.stop_server(vm.openstack_id)
                            if operation_success:
                                vm.status = VirtualMachine.VMStatus.STOPPED
                                vm.last_stop_time = timezone.now()
                                operation_detail = f'虚拟机 {vm.name} 已停止'
                            else:
                                operation_detail = f'停止虚拟机 {vm.name} 失败'

                        elif action == 'restart':
                            operation_success = openstack_service.reboot_server(vm.openstack_id, 'SOFT')
                            if operation_success:
                                vm.status = VirtualMachine.VMStatus.RUNNING
                                vm.last_start_time = timezone.now()
                                operation_detail = f'虚拟机 {vm.name} 已重启'
                            else:
                                operation_detail = f'重启虚拟机 {vm.name} 失败'

                        else:
                            return Response({
                                'error': f'不支持的操作: {action}'
                            }, status=status.HTTP_400_BAD_REQUEST)

                        # 保存虚拟机状态
                        if operation_success:
                            vm.save()
                            # 推送最终状态到前端
                            push_vm_status_update(vm)

                        # 记录操作日志到VMOperationLog
                        VMOperationLog.objects.create(
                            virtual_machine=vm,
                            operation_type=action,
                            operator=request.user,
                            operation_detail=operation_detail,
                            success=operation_success
                        )
                        
                        # 记录活动日志到ActivityLog（用于Dashboard显示）
                        if operation_success:
                            try:
                                from apps.monitoring.models import ActivityLog
                                action_desc = {
                                    'start': '启动',
                                    'stop': '停止',
                                    'restart': '重启'
                                }.get(action, action)
                                
                                ActivityLog.log_activity(
                                    action_type='system',
                                    description=f'{request.user.username} {action_desc}了虚拟机 {vm.name}',
                                    user=request.user,
                                    ip_address=request.META.get('REMOTE_ADDR')
                                )
                            except Exception as e:
                                logger.warning(f'记录活动日志失败: {str(e)}')

                        if operation_success:
                            logger.info(f"虚拟机操作成功: {operation_detail}")
                            return Response({
                                'success': True,
                                'message': operation_detail,
                                'resource_id': resource_id,
                                'resource_type': resource_type,
                                'action': action,
                                'status': vm.status,
                                'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                            })
                        else:
                            logger.error(f"虚拟机操作失败: {operation_detail}")
                            return Response({
                                'error': operation_detail
                            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

                    except Exception as openstack_error:
                        error_msg = f'OpenStack 操作失败: {str(openstack_error)}'
                        logger.error(error_msg)

                        # 记录失败日志
                        VMOperationLog.objects.create(
                            virtual_machine=vm,
                            operation_type=action,
                            operator=request.user,
                            operation_detail=error_msg,
                            success=False
                        )

                        return Response({
                            'error': error_msg
                        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            except VirtualMachine.DoesNotExist:
                return Response({'error': '虚拟机不存在'}, status=status.HTTP_404_NOT_FOUND)
            except VMOperationConflictError as e:
                # 并发操作冲突 - 返回 409 Conflict
                logger.warning(f"VM 操作冲突: {str(e)}")
                return Response({'error': str(e)}, status=409)


        # 其他资源类型的控制（暂时返回成功响应）
        return Response({
            'success': True,
            'message': f'资源{action}操作成功',
            'resource_id': resource_id,
            'resource_type': resource_type,
            'action': action,
            'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
        })
    except Exception as e:
        logger.error(f"控制资源失败: {str(e)}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_subscriptions(request):
    """获取租户的产品和服务订阅情况"""
    try:
        tenant = get_user_tenant(request.user)

        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        # 获取产品订阅（使用select_related优化N+1查询）
        product_subscriptions = ProductSubscription.objects.filter(tenant=tenant).select_related('product')
        products_data = []
        for ps in product_subscriptions:
            products_data.append({
                'id': ps.id,
                'product_name': ps.product.name,
                'product_type': ps.product.get_product_type_display(),
                'quantity': ps.quantity,
                'unit_price': str(ps.unit_price),
                'monthly_cost': str(ps.monthly_cost),
                'status': ps.get_status_display(),
                'start_date': ps.start_date,
                'end_date': ps.end_date
            })

        # 获取服务订阅（使用select_related优化N+1查询）
        service_subscriptions = ServiceSubscription.objects.filter(tenant=tenant).select_related('service')
        services_data = []
        for ss in service_subscriptions:
            services_data.append({
                'id': ss.id,
                'service_name': ss.service.name,
                'service_type': ss.service.get_service_type_display(),
                'unit_price': str(ss.unit_price),
                'monthly_cost': str(ss.monthly_cost),
                'status': ss.get_status_display(),
                'start_date': ss.start_date,
                'end_date': ss.end_date
            })
        
        return Response({
            'products': products_data,
            'services': services_data,
            'total_products': len(products_data),
            'total_services': len(services_data)
        })
    except Exception as e:
        logger.error(f"获取订阅信息失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_information_system(request):
    """租户创建信息系统"""
    try:
        tenant = get_user_tenant(request.user)

        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        data = request.data
        
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
        
        return Response({
            'success': True,
            'message': '信息系统创建成功',
            'system': {
                'id': str(system.id),
                'name': system.name,
                'code': system.code,
                'status': system.status
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"创建信息系统失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def available_products(request):
    """获取可订阅的产品列表"""
    try:
        products = Product.objects.filter(status='active')
        
        products_data = []
        for product in products:
            products_data.append({
                'id': product.id,
                'name': product.name,
                'product_type': product.product_type,
                'product_type_display': product.get_product_type_display(),
                'subcategory': product.subcategory,
                'base_price': str(product.base_price),
                'billing_unit': product.get_billing_unit_display(),
                'description': product.description,
                'cpu_capacity': product.cpu_capacity,
                'memory_capacity': product.memory_capacity,
                'storage_capacity': product.storage_capacity
            })
        
        return Response({
            'products': products_data,
            'total': len(products_data)
        })
    except Exception as e:
        logger.error(f"获取产品列表失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def subscribe_product(request):
    """订阅产品"""
    try:
        tenant = get_user_tenant(request.user)

        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity', 1)

        product = get_object_or_404(Product, id=product_id)

        # 创建产品订阅，默认状态为待审批
        subscription = ProductSubscription.objects.create(
            tenant=tenant,
            product=product,
            quantity=quantity,
            unit_price=product.base_price,
            discount_rate=1.0,
            status='pending',  # 改为待审批状态
            start_date=request.data.get('start_date'),
            end_date=request.data.get('end_date')
        )

        return Response({
            'success': True,
            'message': '产品订阅申请已提交，等待管理员审批',
            'subscription': {
                'id': subscription.id,
                'product_name': product.name,
                'quantity': quantity,
                'monthly_cost': str(subscription.monthly_cost),
                'status': 'pending'
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"订阅产品失败: {str(e)}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_virtual_machine(request):
    """创建虚拟机 - 通过 OpenStack API"""
    vm = None
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        data = request.data
        system_id = data.get('system_id')

        if not system_id:
            return Response({'error': '缺少信息系统ID'}, status=status.HTTP_400_BAD_REQUEST)

        # 获取信息系统并验证权限
        try:
            system = InformationSystem.objects.get(id=system_id)
            if system.tenant != tenant:
                return Response({'error': '无权在此系统中创建虚拟机'}, status=status.HTTP_403_FORBIDDEN)
        except InformationSystem.DoesNotExist:
            return Response({'error': '信息系统不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 获取虚拟机配置
        vm_name = data.get('name')
        
        # 获取启动源类型（新方式）
        source_type = data.get('source_type', 'image')  # 默认为 image
        
        # 新方式：直接使用传入的 flavor_id, network_id
        flavor_id = data.get('flavor_id')
        network_id = data.get('network_id')
        
        # 根据 source_type 获取不同的源 ID
        image_id = data.get('image_id')
        volume_id = data.get('volume_id')
        snapshot_id = data.get('snapshot_id')
        
        logger.info(f"创建虚拟机 - 源类型: {source_type}")
        
        openstack_service = get_openstack_service()
        
        # 获取 flavor
        if flavor_id:
            # 直接使用传入的 flavor_id
            flavors = openstack_service.list_flavors()
            flavor = next((f for f in flavors if f.get('id') == flavor_id), None)
            if not flavor:
                return Response({'error': '指定的实例类型不存在'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # 向后兼容：根据配置自动匹配
            cpu_cores = data.get('cpu_cores', 2)
            memory_gb = data.get('memory_gb', 4)
            disk_gb = data.get('disk_gb', 20)
            logger.info(f"查找合适的 flavor: CPU={cpu_cores}, Memory={memory_gb}GB, Disk={disk_gb}GB")
            flavor = find_suitable_flavor(cpu_cores, memory_gb, disk_gb)
            if not flavor:
                return Response({
                    'error': f'未找到合适的虚拟机规格 (CPU:{cpu_cores}核, 内存:{memory_gb}GB, 磁盘:{disk_gb}GB)'
                }, status=status.HTTP_400_BAD_REQUEST)
        
        logger.info(f"使用 flavor: {flavor.get('name')} ({flavor.get('id')})")
        
        # 根据 source_type 验证和获取启动源
        image = None
        if source_type in ['image', 'instance_snapshot']:
            # 从镜像或实例快照创建
            if image_id:
                # 直接使用传入的 image_id
                images = openstack_service.list_images()
                image = next((img for img in images if img.get('id') == image_id), None)
                if not image:
                    return Response({'error': '指定的镜像不存在'}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # 向后兼容：根据 OS 类型自动匹配
                os_type = data.get('os_type', 'Linux')
                os_version = data.get('os_version', '')
                logger.info(f"查找合适的镜像: OS={os_type}, Version={os_version}")
                image = find_suitable_image(os_type, os_version)
                if not image:
                    return Response({
                        'error': f'未找到合适的操作系统镜像 ({os_type} {os_version})'
                    }, status=status.HTTP_400_BAD_REQUEST)
            logger.info(f"使用镜像: {image.get('name')} ({image.get('id')})")
        elif source_type == 'volume':
            # 从卷创建
            if not volume_id:
                return Response({'error': '从卷创建需要指定 volume_id'}, status=status.HTTP_400_BAD_REQUEST)
            logger.info(f"从卷创建: volume_id={volume_id}")
        elif source_type == 'volume_snapshot':
            # 从卷快照创建
            if not snapshot_id:
                return Response({'error': '从快照创建需要指定 snapshot_id'}, status=status.HTTP_400_BAD_REQUEST)
            logger.info(f"从卷快照创建: snapshot_id={snapshot_id}")
        else:
            return Response({'error': f'不支持的启动源类型: {source_type}'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取网络
        if network_id:
            # 直接使用传入的 network_id
            networks = openstack_service.list_networks()
            network = next((net for net in networks if net.get('id') == network_id), None)
            if not network:
                return Response({'error': '指定的网络不存在'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # 向后兼容：使用默认网络
            logger.info(f"获取租户 {tenant.name} 的网络配置")
            network = get_default_network(tenant)
            if not network:
                return Response({
                    'error': '未找到可用网络，请联系管理员配置网络'
                }, status=status.HTTP_400_BAD_REQUEST)
            
        logger.info(f"使用网络: {network.get('name')} ({network.get('id')})")

        # 从 flavor 中获取实际分配的资源规格
        actual_vcpus = flavor.get('vcpus', 2)
        actual_ram_mb = flavor.get('ram', 4096)
        actual_ram_gb = actual_ram_mb / 1024  # 转换为 GB
        actual_disk = flavor.get('disk', 20)
        
        # 获取 OS 类型（用于数据库记录）
        os_type = data.get('os_type', 'Linux')
        os_version = data.get('os_version', '')
        
        logger.info(f"实际分配资源: CPU={actual_vcpus}核, 内存={actual_ram_gb}GB, 磁盘={actual_disk}GB")

        # 在数据库中创建虚拟机记录，使用 OpenStack flavor 的实际规格
        vm = VirtualMachine.objects.create(
            information_system=system,
            name=vm_name,
            cpu_cores=actual_vcpus,  # 使用实际分配的值
            memory_gb=int(actual_ram_gb),  # 使用实际分配的值
            disk_gb=actual_disk,  # 使用实际分配的值
            data_center_type=data.get('data_center_type', 'production'),
            availability_zone=data.get('availability_zone', ''),
            region=data.get('region', ''),
            runtime_start=data.get('runtime_start'),
            runtime_end=data.get('runtime_end'),
            os_type=os_type,
            os_version=os_version,
            description=data.get('description', ''),
            status=VirtualMachine.VMStatus.STOPPED,
            created_by=request.user
        )

        # 在 OpenStack 中创建虚拟机实例
        logger.info(f"在 OpenStack 中创建虚拟机: {vm_name}")
        logger.info(f"使用 flavor: {flavor.get('name')} ({flavor.get('id')})")
        logger.info(f"使用 network: {network.get('name')} ({network.get('id')})")
        logger.info(f"启动源类型: {source_type}")

        try:
            openstack_service = get_openstack_service()
            
            # 只有当 availability_zone 有值时才传递
            az = data.get('availability_zone')
            extra_kwargs = {}
            if az:
                extra_kwargs['availability_zone'] = az
            
            # 根据 source_type 调用不同的创建方法
            if source_type in ['image', 'instance_snapshot']:
                # 从镜像或实例快照创建
                logger.info(f"使用 image: {image.get('name')} ({image.get('id')})")
                server = openstack_service.create_server(
                    name=vm_name,
                    image_id=image.get('id'),
                    flavor_id=flavor.get('id'),
                    network_ids=[network.get('id')],
                    **extra_kwargs
                )
            elif source_type == 'volume':
                # 从卷创建
                logger.info(f"从卷创建: volume_id={volume_id}")
                server = openstack_service.create_server_from_volume(
                    name=vm_name,
                    volume_id=volume_id,
                    flavor_id=flavor.get('id'),
                    network_ids=[network.get('id')],
                    **extra_kwargs
                )
            elif source_type == 'volume_snapshot':
                # 从卷快照创建
                logger.info(f"从卷快照创建: snapshot_id={snapshot_id}")
                server = openstack_service.create_server_from_snapshot(
                    name=vm_name,
                    snapshot_id=snapshot_id,
                    flavor_id=flavor.get('id'),
                    network_ids=[network.get('id')],
                    **extra_kwargs
                )
            else:
                raise Exception(f"不支持的启动源类型: {source_type}")

            # 更新虚拟机的 OpenStack ID 和网络信息
            vm.openstack_id = server.get('id')

            # 获取分配的 IP 地址
            addresses = server.get('addresses', {})
            if addresses:
                # 获取第一个网络的第一个 IP 地址
                for network_name, addr_list in addresses.items():
                    if addr_list and len(addr_list) > 0:
                        vm.ip_address = addr_list[0].get('addr')
                        if 'OS-EXT-IPS-MAC:mac_addr' in addr_list[0]:
                            vm.mac_address = addr_list[0].get('OS-EXT-IPS-MAC:mac_addr')
                        break

            # 根据 OpenStack 返回的状态更新虚拟机状态
            openstack_status = server.get('status', '').upper()
            if openstack_status == 'ACTIVE':
                vm.status = VirtualMachine.VMStatus.RUNNING
                vm.last_start_time = timezone.now()
            elif openstack_status == 'SHUTOFF':
                vm.status = VirtualMachine.VMStatus.STOPPED
            elif openstack_status == 'ERROR':
                vm.status = VirtualMachine.VMStatus.ERROR

            vm.save()

            # 记录操作日志
            VMOperationLog.objects.create(
                virtual_machine=vm,
                operation_type='create',
                operator=request.user,
                operation_detail=f'在 OpenStack 中创建虚拟机 {vm.name}，实例ID: {vm.openstack_id}',
                success=True
            )
            
            # 记录活动日志（用于Dashboard显示）
            try:
                from apps.monitoring.models import ActivityLog
                ActivityLog.log_activity(
                    action_type='create',
                    description=f'{request.user.username} 创建了虚拟机 {vm.name}',
                    user=request.user,
                    ip_address=request.META.get('REMOTE_ADDR')
                )
            except Exception as e:
                logger.warning(f'记录活动日志失败: {str(e)}')

            logger.info(f"虚拟机创建成功: {vm.name} (OpenStack ID: {vm.openstack_id})")

            return Response({
                'success': True,
                'message': '虚拟机创建成功',
                'vm': {
                    'id': str(vm.id),
                    'name': vm.name,
                    'cpu_cores': vm.cpu_cores,
                    'memory_gb': vm.memory_gb,
                    'disk_gb': vm.disk_gb,
                    'ip_address': vm.ip_address or '分配中',
                    'mac_address': vm.mac_address or '分配中',
                    'status': vm.status,
                    'status_display': vm.get_status_display(),
                    'openstack_id': vm.openstack_id
                }
            }, status=status.HTTP_201_CREATED)

        except Exception as openstack_error:
            # OpenStack 创建失败，删除数据库记录
            logger.error(f"OpenStack 创建虚拟机失败: {str(openstack_error)}")

            # 记录失败日志
            VMOperationLog.objects.create(
                virtual_machine=vm,
                operation_type='create',
                operator=request.user,
                operation_detail=f'在 OpenStack 中创建虚拟机失败: {str(openstack_error)}',
                success=False
            )

            # 删除数据库记录
            vm.delete()

            return Response({
                'error': f'创建虚拟机失败: {str(openstack_error)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"创建虚拟机失败: {str(e)}", exc_info=True)

        # 如果虚拟机已创建，记录失败日志
        if vm:
            VMOperationLog.objects.create(
                virtual_machine=vm,
                operation_type='create',
                operator=request.user,
                operation_detail=f'创建虚拟机失败: {str(e)}',
                success=False
            )

        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_virtual_machine_detail(request, vm_id):
    """获取虚拟机详细信息"""
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        # 获取虚拟机并验证权限
        try:
            vm = VirtualMachine.objects.get(id=vm_id)
            if vm.information_system.tenant != tenant:
                return Response({'error': '无权查看此虚拟机'}, status=status.HTTP_403_FORBIDDEN)
        except VirtualMachine.DoesNotExist:
            return Response({'error': '虚拟机不存在'}, status=status.HTTP_404_NOT_FOUND)

        # 获取操作日志
        logs = VMOperationLog.objects.filter(virtual_machine=vm).order_by('-operation_time')[:10]
        logs_data = []
        for log in logs:
            logs_data.append({
                'operation_type': log.get_operation_type_display(),
                'operator': log.operator.username if log.operator else '系统',
                'operation_time': log.operation_time.strftime('%Y-%m-%d %H:%M:%S'),
                'operation_detail': log.operation_detail,
                'success': log.success
            })

        # 虚拟机详细信息
        vm_detail = {
            'id': str(vm.id),
            'name': vm.name,
            'information_system': {
                'id': str(vm.information_system.id),
                'name': vm.information_system.name,
                'code': vm.information_system.code
            },
            'cpu_cores': vm.cpu_cores,
            'memory_gb': vm.memory_gb,
            'disk_gb': vm.disk_gb,
            'ip_address': vm.ip_address or '未分配',
            'mac_address': vm.mac_address or '未分配',
            'status': vm.status,
            'status_display': vm.get_status_display(),
            'runtime_start': vm.runtime_start.strftime('%H:%M') if vm.runtime_start else None,
            'runtime_end': vm.runtime_end.strftime('%H:%M') if vm.runtime_end else None,
            'runtime_display': vm.runtime_display,
            'os_type': vm.os_type or '未知',
            'os_version': vm.os_version or '未知',
            'description': vm.description,
            'created_at': vm.created_at.strftime('%Y-%m-%d %H:%M:%S'),
            'last_start_time': vm.last_start_time.strftime('%Y-%m-%d %H:%M:%S') if vm.last_start_time else None,
            'last_stop_time': vm.last_stop_time.strftime('%Y-%m-%d %H:%M:%S') if vm.last_stop_time else None,
            'operation_logs': logs_data
        }

        return Response(vm_detail)
    except Exception as e:
        logger.error(f"获取虚拟机详情失败: {str(e)}", exc_info=True)
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_virtual_machine(request, vm_id):
    """删除虚拟机"""
    try:
        # 获取虚拟机
        vm = get_object_or_404(VirtualMachine, id=vm_id)
        
        # 检查权限
        if not request.user.profile.is_admin:
            # 租户用户只能删除自己租户的虚拟机
            if vm.information_system.tenant != request.user.profile.tenant:
                return Response({'error': '无权操作此虚拟机'}, status=status.HTTP_403_FORBIDDEN)
        
        vm_name = vm.name
        openstack_id = vm.openstack_id
        
        # 调用OpenStack删除
        try:
            openstack_service = get_openstack_service()
            if openstack_id:
                success = openstack_service.delete_server(openstack_id)
                if not success:
                    logger.warning(f"从 OpenStack 删除虚拟机失败: {vm_name} ({openstack_id})")
        except Exception as e:
            logger.error(f"OpenStack删除虚拟机失败: {str(e)}")
            # 继续删除本地记录
            
        # 记录操作日志
        VMOperationLog.objects.create(
            virtual_machine=vm,
            operation_type='delete',
            operator=request.user,
            description=f"删除虚拟机: {vm_name}",
            status='success'
        )
        
        # 删除本地记录
        vm.delete()
        
        return Response({'success': True, 'message': '虚拟机删除成功'})
        
    except Exception as e:
        logger.error(f"删除虚拟机失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_availability_zones(request):
    """获取可用区列表"""
    try:
        openstack_service = get_openstack_service()
        zones = openstack_service.list_availability_zones()
        return Response({'success': True, 'zones': zones})
    except Exception as e:
        logger.error(f"获取可用区列表失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resize_virtual_machine(request, vm_id):
    """调整虚拟机配置"""
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        # 获取虚拟机并验证权限
        try:
            vm = VirtualMachine.objects.get(id=vm_id)
            # 租户用户权限检查
            if not request.user.profile.is_admin:
                if vm.information_system.tenant != tenant:
                    return Response({'error': '无权操作此虚拟机'}, status=status.HTTP_403_FORBIDDEN)
        except VirtualMachine.DoesNotExist:
            return Response({'error': '虚拟机不存在'}, status=status.HTTP_404_NOT_FOUND)
        
        # 检查虚拟机状态（只有停止状态才能调整）
        if vm.status == VirtualMachine.VMStatus.RUNNING:
            return Response({
                'error': '虚拟机正在运行，请先停止虚拟机再调整配置'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 获取新的配置
        new_cpu = request.data.get('cpu_cores')
        new_memory = request.data.get('memory_gb')
        new_disk = request.data.get('disk_gb')
        
        if not all([new_cpu, new_memory, new_disk]):
            return Response({'error': '缺少必要参数'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 检查配置是否有变化
        if (vm.cpu_cores == new_cpu and 
            vm.memory_gb == new_memory and 
            vm.disk_gb == new_disk):
            return Response({'error': '配置未发生变化'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 查找合适的 flavor
        from ..tenants.utils import find_suitable_flavor
        new_flavor = find_suitable_flavor(new_cpu, new_memory, new_disk)
        if not new_flavor:
            return Response({
                'error': f'未找到合适的规格配置 (CPU:{new_cpu}核, 内存:{new_memory}GB, 磁盘:{new_disk}GB)'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        # 如果有 OpenStack ID，执行 resize
        if vm.openstack_id:
            openstack_service = get_openstack_service()
            success = openstack_service.resize_server(vm.openstack_id, new_flavor['id'])
            
            if not success:
                return Response({
                    'error': 'OpenStack 配置调整失败'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        # 更新数据库
        old_config = f'{vm.cpu_cores}核/{vm.memory_gb}GB/{vm.disk_gb}GB'
        vm.cpu_cores = new_cpu
        vm.memory_gb = new_memory
        vm.disk_gb = new_disk
        vm.save()
        
        # 记录操作日志
        VMOperationLog.objects.create(
            virtual_machine=vm,
            operation_type='resize',
            operator=request.user,
            operation_detail=f'调整配置: {old_config} -> {new_cpu}核/{new_memory}GB/{new_disk}GB',
            success=True
        )
        
        logger.info(f"虚拟机 {vm.name} 配置调整成功: {old_config} -> {new_cpu}核/{new_memory}GB/{new_disk}GB")
        
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
        
    except Exception as e:
        logger.error(f"调整虚拟机配置失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
