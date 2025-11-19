"""
租户门户视图 - 租户自助服务功能
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
from django.utils import timezone
import logging
import random

from .models import Tenant, Stakeholder
from .user_models import UserProfile
from ..information_systems.models import InformationSystem, VirtualMachine, VMOperationLog
from ..products.models import Product, ProductSubscription
from ..services.models import Service, ServiceSubscription

logger = logging.getLogger(__name__)


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
            systems_data.append({
                'id': str(system.id),
                'name': system.name,
                'code': system.code,
                'status': system.status,
                'status_display': system.get_status_display(),
                'operation_mode': system.operation_mode,
                'operation_mode_display': system.get_operation_mode_display(),
                'description': system.description,
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

        # 获取信息系统及其资源
        systems = InformationSystem.objects.filter(tenant=tenant)

        orders_data = []
        for system in systems:
            # 获取虚拟机信息
            vms = VirtualMachine.objects.filter(information_system=system)
            vm_resources = []
            for vm in vms:
                vm_resources.append({
                    'id': str(vm.id),
                    'name': vm.name,
                    'ip': vm.ip_address or '未分配',
                    'runtime': vm.runtime_display,
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
    """控制资源的启停"""
    try:
        tenant = get_user_tenant(request.user)
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)

        resource_id = request.data.get('resource_id')
        resource_type = request.data.get('resource_type')  # vm, storage, network
        action = request.data.get('action')  # start, stop

        if not all([resource_id, resource_type, action]):
            return Response({'error': '缺少必要参数'}, status=status.HTTP_400_BAD_REQUEST)

        # 处理虚拟机控制
        if resource_type == 'vm':
            try:
                vm = VirtualMachine.objects.get(id=resource_id)

                # 验证虚拟机属于该租户
                if vm.information_system.tenant != tenant:
                    return Response({'error': '无权操作此资源'}, status=status.HTTP_403_FORBIDDEN)

                # 执行操作
                if action == 'start':
                    vm.status = VirtualMachine.VMStatus.RUNNING
                    vm.last_start_time = timezone.now()
                    operation_detail = f'虚拟机 {vm.name} 已启动'
                elif action == 'stop':
                    vm.status = VirtualMachine.VMStatus.STOPPED
                    vm.last_stop_time = timezone.now()
                    operation_detail = f'虚拟机 {vm.name} 已停止'
                else:
                    return Response({'error': '不支持的操作'}, status=status.HTTP_400_BAD_REQUEST)

                vm.save()

                # 记录操作日志
                VMOperationLog.objects.create(
                    virtual_machine=vm,
                    operation_type=action,
                    operator=request.user,
                    operation_detail=operation_detail,
                    success=True
                )

                return Response({
                    'success': True,
                    'message': operation_detail,
                    'resource_id': resource_id,
                    'resource_type': resource_type,
                    'action': action,
                    'status': vm.status,
                    'timestamp': timezone.now().strftime('%Y-%m-%d %H:%M:%S')
                })
            except VirtualMachine.DoesNotExist:
                return Response({'error': '虚拟机不存在'}, status=status.HTTP_404_NOT_FOUND)

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
        
        # 获取产品订阅
        product_subscriptions = ProductSubscription.objects.filter(tenant=tenant)
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
        
        # 获取服务订阅
        service_subscriptions = ServiceSubscription.objects.filter(tenant=tenant)
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
    """创建虚拟机"""
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

        # 创建虚拟机
        vm = VirtualMachine.objects.create(
            information_system=system,
            name=data.get('name'),
            cpu_cores=data.get('cpu_cores', 2),
            memory_gb=data.get('memory_gb', 4),
            disk_gb=data.get('disk_gb', 100),
            ip_address=data.get('ip_address'),
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

        # 记录操作日志
        VMOperationLog.objects.create(
            virtual_machine=vm,
            operation_type='create',
            operator=request.user,
            operation_detail=f'创建虚拟机 {vm.name}',
            success=True
        )

        return Response({
            'success': True,
            'message': '虚拟机创建成功',
            'vm': {
                'id': str(vm.id),
                'name': vm.name,
                'cpu_cores': vm.cpu_cores,
                'memory_gb': vm.memory_gb,
                'disk_gb': vm.disk_gb,
                'ip_address': vm.ip_address,
                'status': vm.status,
                'status_display': vm.get_status_display()
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"创建虚拟机失败: {str(e)}", exc_info=True)
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
