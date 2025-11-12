"""
合同管理路由配置
"""

from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ContractViewSet, ContractItemViewSet, ContractPaymentViewSet, ContractRenewalViewSet

router = DefaultRouter()
router.register(r'', ContractViewSet, basename='contract')
router.register(r'items', ContractItemViewSet, basename='contract-item')
router.register(r'payments', ContractPaymentViewSet, basename='contract-payment')
router.register(r'renewals', ContractRenewalViewSet, basename='contract-renewal')

urlpatterns = [
    path('', include(router.urls)),
]