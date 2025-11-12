"""
OpenStack集成路由配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    OpenStackResourceViewSet,
    OpenStackProjectViewSet,
    OpenStackServerViewSet,
    OpenStackImageViewSet,
    OpenStackFlavorViewSet,
    OpenStackNetworkViewSet,
    check_connection,
    sync_tenant,
    tenant_usage,
    create_tenant_resources_view
)

router = DefaultRouter()
router.register(r'resources', OpenStackResourceViewSet, basename='openstack-resources')
router.register(r'projects', OpenStackProjectViewSet, basename='openstack-projects')
router.register(r'servers', OpenStackServerViewSet, basename='openstack-servers')
router.register(r'images', OpenStackImageViewSet, basename='openstack-images')
router.register(r'flavors', OpenStackFlavorViewSet, basename='openstack-flavors')
router.register(r'networks', OpenStackNetworkViewSet, basename='openstack-networks')

urlpatterns = [
    # 路由器生成的URL
    path('', include(router.urls)),

    # 自定义URL
    path('check-connection/', check_connection, name='openstack-check-connection'),
    path('tenants/<uuid:tenant_id>/sync/', sync_tenant, name='openstack-sync-tenant'),
    path('tenants/<uuid:tenant_id>/usage/', tenant_usage, name='openstack-tenant-usage'),
    path('tenants/<uuid:tenant_id>/create-resources/', create_tenant_resources_view,
         name='openstack-create-tenant-resources'),
]