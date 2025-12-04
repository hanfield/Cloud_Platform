"""
信息系统管理URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InformationSystemViewSet,
    SystemResourceViewSet,
    SystemBillingRecordViewSet,
    SystemBillingRecordViewSet,
    SystemOperationLogViewSet,
    VMSnapshotViewSet
)

# 创建主路由器
router = DefaultRouter()

# 系统资源相关路由
router.register(r'system-resources', SystemResourceViewSet, basename='system-resource')
router.register(r'billing-records', SystemBillingRecordViewSet, basename='billing-record')
router.register(r'operation-logs', SystemOperationLogViewSet, basename='operation-log')

# 单独注册快照路由（不通过嵌套）
snapshot_router = DefaultRouter()
snapshot_router.register(r'snapshots', VMSnapshotViewSet, basename='vm-snapshot')

urlpatterns = [
    # 快照路由（优先匹配）
    path('', include(snapshot_router.urls)),
    # 信息系统路由（放在最后）
    path('', InformationSystemViewSet.as_view({
        'get': 'list',
        'post': 'create'
    })),
    path('<uuid:pk>/', InformationSystemViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    })),
    # 信息系统的自定义 actions
    path('virtual_machines_overview/', InformationSystemViewSet.as_view({'get': 'virtual_machines_overview'})),
    path('sync_openstack/', InformationSystemViewSet.as_view({'post': 'sync_openstack'})),
    path('statistics/', InformationSystemViewSet.as_view({'get': 'statistics'})),
    path('<uuid:pk>/resources/', InformationSystemViewSet.as_view({'get': 'resources'})),
    path('<uuid:pk>/status/', InformationSystemViewSet.as_view({'patch': 'status'})),
    path('<uuid:pk>/runtime-stats/', InformationSystemViewSet.as_view({'get': 'runtime_stats'})),
    path('<uuid:pk>/billing/', InformationSystemViewSet.as_view({'get': 'billing'})),
    path('<uuid:pk>/detailed_info/', InformationSystemViewSet.as_view({'get': 'detailed_info'})),
    # 其他资源路由
    path('', include(router.urls)),
]