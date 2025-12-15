"""
租户管理路由配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, TenantResourceUsageViewSet, TenantOperationLogViewSet, StakeholderViewSet, DataCenterViewSet
from .user_views import UserProfileViewSet, user_register
from .tenant_portal_views import (
    tenant_profile,
    tenant_systems_overview,
    tenant_orders,
    control_resource,
    tenant_subscriptions,
    create_information_system,
    available_products,
    subscribe_product,
    create_virtual_machine,
    get_virtual_machine_detail,
    create_virtual_machine,
    get_virtual_machine_detail,
    delete_virtual_machine,
    resize_virtual_machine,
    get_availability_zones
)
from .admin_resource_management import (
    admin_create_information_system,
    admin_create_virtual_machine,
    admin_start_virtual_machine,
    admin_stop_virtual_machine,
    admin_delete_virtual_machine,
    admin_resize_virtual_machine,
    admin_start_information_system,
    get_all_tenants
)

router = DefaultRouter()
# 注意：users必须在空路径''之前注册，否则会被''拦截
router.register(r'users', UserProfileViewSet, basename='user')
router.register(r'resource-usage', TenantResourceUsageViewSet, basename='tenant-resource-usage')
router.register(r'operation-logs', TenantOperationLogViewSet, basename='tenant-operation-log')
router.register(r'stakeholders', StakeholderViewSet, basename='stakeholder')
router.register(r'datacenters', DataCenterViewSet, basename='datacenter')
router.register(r'', TenantViewSet, basename='tenant')

urlpatterns = [
    path('', include(router.urls)),

    # 用户注册API（公开）
    path('register/', user_register, name='user-register'),

    # 租户门户API
    path('portal/profile/', tenant_profile, name='tenant-portal-profile'),
    path('portal/systems-overview/', tenant_systems_overview, name='tenant-portal-systems-overview'),
    path('portal/orders/', tenant_orders, name='tenant-portal-orders'),
    path('portal/control-resource/', control_resource, name='tenant-portal-control-resource'),
    path('portal/subscriptions/', tenant_subscriptions, name='tenant-portal-subscriptions'),
    path('portal/create-system/', create_information_system, name='tenant-portal-create-system'),
    path('portal/available-products/', available_products, name='tenant-portal-available-products'),
    path('portal/subscribe-product/', subscribe_product, name='tenant-portal-subscribe-product'),
    path('portal/create-vm/', create_virtual_machine, name='tenant-portal-create-vm'),
    path('portal/vm/<uuid:vm_id>/', get_virtual_machine_detail, name='tenant-portal-vm-detail'),
    path('portal/vm/<uuid:vm_id>/', get_virtual_machine_detail, name='tenant-portal-vm-detail'),
    path('portal/vm/<uuid:vm_id>/delete/', delete_virtual_machine, name='tenant-portal-delete-vm'),
    path('portal/vm/<uuid:vm_id>/resize/', resize_virtual_machine, name='tenant-portal-resize-vm'),
    path('portal/availability-zones/', get_availability_zones, name='tenant-portal-availability-zones'),

    # 管理员资源管理API
    path('admin/tenants/', get_all_tenants, name='admin-get-all-tenants'),
    path('admin/create-system/', admin_create_information_system, name='admin-create-system'),
    path('admin/create-vm/', admin_create_virtual_machine, name='admin-create-vm'),
    path('admin/system/<uuid:system_id>/start/', admin_start_information_system, name='admin-start-system'),
    path('admin/vm/<uuid:vm_id>/start/', admin_start_virtual_machine, name='admin-start-vm'),
    path('admin/vm/<uuid:vm_id>/stop/', admin_stop_virtual_machine, name='admin-stop-vm'),
    path('admin/vm/<uuid:vm_id>/delete/', admin_delete_virtual_machine, name='admin-delete-vm'),
    path('admin/vm/<uuid:vm_id>/resize/', admin_resize_virtual_machine, name='admin-resize-vm'),
]