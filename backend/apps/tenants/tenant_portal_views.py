"""
租户门户视图 - 租户自助服务功能
"""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from django.db.models import Sum, Count
import logging

from .models import Tenant, Stakeholder
from ..information_systems.models import InformationSystem
from ..products.models import Product, ProductSubscription
from ..services.models import Service, ServiceSubscription

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_profile(request):
    """获取当前租户的基本信息和干系人信息"""
    try:
        # 这里假设用户关联了租户，实际项目中需要建立用户-租户关系
        # 暂时使用第一个租户作为示例
        tenant = Tenant.objects.first()
        
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        # 获取干系人信息
        stakeholders = Stakeholder.objects.filter(tenant=tenant)
        stakeholder_data = []
        for sh in stakeholders:
            stakeholder_data.append({
                'id': sh.id,
                'role': sh.role,
                'role_display': sh.get_role_display(),
                'name': sh.name,
                'phone': sh.phone,  # 已加密
                'email': sh.email,  # 已加密
                'department': sh.department,
                'position': sh.position
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
        tenant = Tenant.objects.first()
        
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
                'runtime_mode': system.runtime_mode,
                'runtime_mode_display': system.get_runtime_mode_display(),
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
        tenant = Tenant.objects.first()
        
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        # 获取信息系统及其资源
        systems = InformationSystem.objects.filter(tenant=tenant)
        
        orders_data = []
        for system in systems:
            # 虚拟机信息（模拟数据，实际应从OpenStack获取）
            vm_resources = [
                {
                    'name': f'{system.name}-VM-1',
                    'ip': '192.168.1.10',
                    'runtime': '0:00-23:59',
                    'status': 'running',
                    'cpu': 4,
                    'memory': 8,
                    'disk': 100
                },
                {
                    'name': f'{system.name}-VM-2',
                    'ip': '192.168.1.11',
                    'runtime': '0:00-18:32',
                    'status': 'stopped',
                    'cpu': 2,
                    'memory': 4,
                    'disk': 50
                }
            ]
            
            # 存储信息
            storage_info = {
                'subscribed_capacity': 500,  # GB
                'used_capacity': 320,
                'available_capacity': 180
            }
            
            # 网络信息
            network_info = {
                'line_type': '数据专线',
                'bandwidth': 100,  # Mbps
                'start_time': '2025-01-01',
                'status': 'active'
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
        resource_id = request.data.get('resource_id')
        resource_type = request.data.get('resource_type')  # vm, storage, network
        action = request.data.get('action')  # start, stop
        
        if not all([resource_id, resource_type, action]):
            return Response({'error': '缺少必要参数'}, status=status.HTTP_400_BAD_REQUEST)
        
        # 这里应该调用OpenStack API进行实际的资源控制
        # 暂时返回成功响应
        
        return Response({
            'success': True,
            'message': f'资源{action}操作成功',
            'resource_id': resource_id,
            'resource_type': resource_type,
            'action': action,
            'timestamp': '2025-11-14 10:00:00'
        })
    except Exception as e:
        logger.error(f"控制资源失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def tenant_subscriptions(request):
    """获取租户的产品和服务订阅情况"""
    try:
        tenant = Tenant.objects.first()
        
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
        tenant = Tenant.objects.first()
        
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        data = request.data
        
        # 创建信息系统
        system = InformationSystem.objects.create(
            tenant=tenant,
            name=data.get('name'),
            code=data.get('code'),
            description=data.get('description', ''),
            runtime_mode=data.get('runtime_mode', '7x24'),
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
                'sub_category': product.sub_category,
                'sub_category_display': product.get_sub_category_display() if product.sub_category else '',
                'base_price': str(product.base_price),
                'billing_unit': product.get_billing_unit_display(),
                'description': product.description
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
        tenant = Tenant.objects.first()
        
        if not tenant:
            return Response({'error': '未找到租户信息'}, status=status.HTTP_404_NOT_FOUND)
        
        product_id = request.data.get('product_id')
        quantity = request.data.get('quantity', 1)
        
        product = get_object_or_404(Product, id=product_id)
        
        # 创建产品订阅
        subscription = ProductSubscription.objects.create(
            tenant=tenant,
            product=product,
            quantity=quantity,
            unit_price=product.base_price,
            discount_rate=1.0,
            status='active',
            start_date=request.data.get('start_date'),
            end_date=request.data.get('end_date')
        )
        
        return Response({
            'success': True,
            'message': '产品订阅成功',
            'subscription': {
                'id': subscription.id,
                'product_name': product.name,
                'quantity': quantity,
                'monthly_cost': str(subscription.monthly_cost)
            }
        }, status=status.HTTP_201_CREATED)
    except Exception as e:
        logger.error(f"订阅产品失败: {str(e)}")
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
