"""
租户管理路由配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TenantViewSet, TenantResourceUsageViewSet, TenantOperationLogViewSet

router = DefaultRouter()
router.register(r'', TenantViewSet, basename='tenant')
router.register(r'resource-usage', TenantResourceUsageViewSet, basename='tenant-resource-usage')
router.register(r'operation-logs', TenantOperationLogViewSet, basename='tenant-operation-log')

urlpatterns = [
    path('', include(router.urls)),
]