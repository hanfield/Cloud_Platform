"""
信息系统管理URL配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    InformationSystemViewSet,
    SystemResourceViewSet,
    SystemBillingRecordViewSet,
    SystemOperationLogViewSet
)

router = DefaultRouter()
router.register(r'information-systems', InformationSystemViewSet, basename='information-system')
router.register(r'system-resources', SystemResourceViewSet, basename='system-resource')
router.register(r'billing-records', SystemBillingRecordViewSet, basename='billing-record')
router.register(r'operation-logs', SystemOperationLogViewSet, basename='operation-log')

urlpatterns = [
    path('', include(router.urls)),
]