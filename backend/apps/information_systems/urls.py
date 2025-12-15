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
    # 信息系统路由（必须放在最前面，否则会被 router 的 API root 拦截）
    path('', InformationSystemViewSet.as_view({
        'get': 'list',
        'post': 'create'
    }), name='information-system-list'),
    path('<uuid:pk>/', InformationSystemViewSet.as_view({
        'get': 'retrieve',
        'put': 'update',
        'patch': 'partial_update',
        'delete': 'destroy'
    }), name='information-system-detail'),
    # 信息系统的自定义 actions
    path('sync_openstack/', InformationSystemViewSet.as_view({'post': 'sync_openstack'})),
    path('statistics/', InformationSystemViewSet.as_view({'get': 'statistics'})),
    path('<uuid:pk>/resources/', InformationSystemViewSet.as_view({'get': 'resources'})),
    path('<uuid:pk>/start/', InformationSystemViewSet.as_view({'post': 'start'})),
    path('<uuid:pk>/stop/', InformationSystemViewSet.as_view({'post': 'stop'})),
    path('<uuid:pk>/maintenance/', InformationSystemViewSet.as_view({'post': 'maintenance'})),
    path('<uuid:pk>/runtime-stats/', InformationSystemViewSet.as_view({'get': 'runtime_stats'})),
    path('<uuid:pk>/billing/', InformationSystemViewSet.as_view({'get': 'billing'})),
    path('<uuid:pk>/detailed_info/', InformationSystemViewSet.as_view({'get': 'detailed_info'})),
    # 快照路由（在信息系统主路由之后）
    path('snapshots/', include([
        path('', VMSnapshotViewSet.as_view({'get': 'list', 'post': 'create'}), name='vm-snapshot-list'),
        path('<uuid:pk>/', VMSnapshotViewSet.as_view({'get': 'retrieve', 'delete': 'destroy'}), name='vm-snapshot-detail'),
        path('<uuid:pk>/restore/', VMSnapshotViewSet.as_view({'post': 'restore'}), name='vm-snapshot-restore'),
    ])),
    # 其他资源路由
    path('system-resources/', include([
        path('', SystemResourceViewSet.as_view({'get': 'list', 'post': 'create'})),
        path('<uuid:pk>/', SystemResourceViewSet.as_view({'get': 'retrieve', 'put': 'update', 'patch': 'partial_update', 'delete': 'destroy'})),
    ])),
    path('billing-records/', include([
        path('', SystemBillingRecordViewSet.as_view({'get': 'list'})),
        path('<uuid:pk>/', SystemBillingRecordViewSet.as_view({'get': 'retrieve'})),
    ])),
    path('operation-logs/', include([
        path('', SystemOperationLogViewSet.as_view({'get': 'list'})),
        path('<uuid:pk>/', SystemOperationLogViewSet.as_view({'get': 'retrieve'})),
    ])),
]