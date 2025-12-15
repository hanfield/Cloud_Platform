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
    OpenStackVolumeViewSet,
    OpenStackVolumeSnapshotViewSet,
    OpenStackNetworkViewSet,
    FloatingIPViewSet,
    SecurityGroupViewSet,
    check_connection,
    sync_tenant,
    tenant_usage,
    create_tenant_resources_view,
    cloud_overview,
    resource_usage_report,
    network_traffic_stats,
    collect_vm_metrics
)

router = DefaultRouter()
router.register(r'resources', OpenStackResourceViewSet, basename='openstack-resources')
router.register(r'projects', OpenStackProjectViewSet, basename='openstack-projects')
router.register(r'servers', OpenStackServerViewSet, basename='openstack-servers')
router.register(r'images', OpenStackImageViewSet, basename='openstack-images')
router.register(r'flavors', OpenStackFlavorViewSet, basename='openstack-flavors')
router.register(r'volumes', OpenStackVolumeViewSet, basename='openstack-volumes')
router.register(r'volume-snapshots', OpenStackVolumeSnapshotViewSet, basename='openstack-volume-snapshots')
router.register(r'networks', OpenStackNetworkViewSet, basename='openstack-networks')
router.register(r'floating-ips', FloatingIPViewSet, basename='floating-ips')
router.register(r'security-groups', SecurityGroupViewSet, basename='security-groups')


urlpatterns = [
    # 路由器生成的URL
    path('', include(router.urls)),

    # 自定义URL
    path('check-connection/', check_connection, name='openstack-check-connection'),
    path('cloud-overview/', cloud_overview, name='cloud-overview'),
    path('usage-report/', resource_usage_report, name='resource-usage-report'),
    path('network-traffic/', network_traffic_stats, name='network-traffic-stats'),
    path('collect-vm-metrics/', collect_vm_metrics, name='collect-vm-metrics'),
    path('tenants/<uuid:tenant_id>/sync/', sync_tenant, name='openstack-sync-tenant'),
    path('tenants/<uuid:tenant_id>/usage/', tenant_usage, name='openstack-tenant-usage'),
    path('tenants/<uuid:tenant_id>/create-resources/', create_tenant_resources_view,
         name='openstack-create-tenant-resources'),
]